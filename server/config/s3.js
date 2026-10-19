const fs = require("fs");
const path = require("path");
const {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
	DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const region = process.env.AWS_REGION || "us-east-1";
const bucketName =
	process.env.AWS_S3_BUCKET ||
	process.env.S3_BUCKET_NAME ||
	"taskgenie-production-assets";

const getPublicFileUrl = (key) => {
	const customPublicUrl = process.env.S3_PUBLIC_URL || process.env.R2_PUBLIC_URL;
	if (customPublicUrl) {
		return `${customPublicUrl.replace(/\/$/, "")}/${key}`;
	}
	return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
};

const isConfigured = Boolean(
	(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
		process.env.AWS_ENDPOINT_URL_S3 ||
		process.env.S3_ENDPOINT,
);

let s3Client = null;

if (isConfigured) {
	const config = {
		region,
	};

	if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
		config.credentials = {
			accessKeyId: process.env.AWS_ACCESS_KEY_ID,
			secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
		};
		if (process.env.AWS_SESSION_TOKEN) {
			config.credentials.sessionToken = process.env.AWS_SESSION_TOKEN;
		}
	}

	// Support custom endpoint (LocalStack, MinIO, Cloudflare R2)
	const customEndpoint =
		process.env.AWS_ENDPOINT_URL_S3 || process.env.S3_ENDPOINT;
	if (customEndpoint) {
		config.endpoint = customEndpoint;
		config.forcePathStyle = true;
	}

	s3Client = new S3Client(config);
}

/**
 * Generate a presigned PUT URL for direct client-to-S3 upload
 * Eliminates server memory overhead & bandwidth saturation
 */
const generatePresignedUploadUrl = async ({
	key,
	contentType,
	expiresIn = 300,
}) => {
	if (!s3Client) {
		return {
			uploadUrl: `/api/providers/mock-s3-upload?key=${encodeURIComponent(key)}`,
			fileUrl: `https://${bucketName}.s3.${region}.amazonaws.com/${key}`,
			fileKey: key,
			isMock: true,
		};
	}

	const command = new PutObjectCommand({
		Bucket: bucketName,
		Key: key,
		ContentType: contentType || "application/octet-stream",
		ServerSideEncryption: "AES256",
	});

	const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });
	const fileUrl = getPublicFileUrl(key);

	return { uploadUrl, fileUrl, fileKey: key, isMock: false };
};

/**
 * Generate a presigned GET URL for secure ephemeral viewing of private KYC documents
 */
const generatePresignedDownloadUrl = async ({ key, expiresIn = 3600 }) => {
	if (!s3Client) {
		return {
			downloadUrl: `https://${bucketName}.s3.${region}.amazonaws.com/${key}`,
			isMock: true,
		};
	}

	const command = new GetObjectCommand({
		Bucket: bucketName,
		Key: key,
	});

	const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn });
	return { downloadUrl, isMock: false };
};

/**
 * Upload an in-memory buffer directly to S3 (used for backward-compatible multipart ingestion)
 */
const uploadBufferToS3 = async ({ buffer, key, contentType }) => {
	if (!s3Client) {
		// Store file on local disk instead of inflating PostgreSQL with massive base64 strings
		try {
			const uploadsDir = path.join(__dirname, "../uploads");
			const targetPath = path.join(uploadsDir, key);
			const targetDir = path.dirname(targetPath);
			if (!fs.existsSync(targetDir)) {
				fs.mkdirSync(targetDir, { recursive: true });
			}
			await fs.promises.writeFile(targetPath, buffer);
			return {
				fileUrl: `/uploads/${key}`,
				key,
				isMock: true,
			};
		} catch (fsErr) {
			console.warn("Local storage write error:", fsErr.message);
			return {
				fileUrl: `/uploads/${key}`,
				key,
				isMock: true,
			};
		}
	}

	const command = new PutObjectCommand({
		Bucket: bucketName,
		Key: key,
		Body: buffer,
		ContentType: contentType || "application/octet-stream",
		ServerSideEncryption: "AES256",
	});

	await s3Client.send(command);
	const fileUrl = getPublicFileUrl(key);

	return { fileUrl, key, isMock: false };
};

/**
 * Delete an object from S3 or local fallback
 */
const deleteS3Object = async ({ key }) => {
	if (!key) return;
	if (!s3Client) {
		try {
			const targetPath = path.join(__dirname, "../uploads", key);
			if (fs.existsSync(targetPath)) {
				await fs.promises.unlink(targetPath);
			}
		} catch (_) {}
		return;
	}

	const command = new DeleteObjectCommand({
		Bucket: bucketName,
		Key: key,
	});

	return s3Client.send(command);
};

module.exports = {
	s3Client,
	bucketName,
	region,
	isConfigured,
	generatePresignedUploadUrl,
	generatePresignedDownloadUrl,
	uploadBufferToS3,
	deleteS3Object,
};
