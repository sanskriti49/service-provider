require("dotenv").config();
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const pool = require("./config/db");

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadImages = async () => {
	try {
		const dirPath = path.join(__dirname, "seed_images");
		if (!fs.existsSync(dirPath)) {
			throw new Error(`Folder not found: ${dirPath}`);
		}
		const files = fs.readdirSync(directoryPath);
		console.log(`Found ${files.length} images. Starting Cloudinary upload..`);

		for (const file of files) {
			if (file.startsWith(".")) continue;
			const slug = path.parse(file).name;
			const filePath = path.join(directoryPath, file);

			console.log(`... Processing: ${slug}`);
			const result = await cloudinary.uploader.upload(filePath, {
				public_id: slug,
				folder: "services",
				overwrite: true,
			});
		}
		process.exit();
	} catch (err) {
		console.error("Error:", err);
		process.exit(1);
	}
};
uploadImages();
