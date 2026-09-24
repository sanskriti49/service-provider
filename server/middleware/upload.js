const multer = require("multer");

const storage = multer.memoryStorage();

const upload = multer({
	storage,
	limits: {
		fileSize: 5 * 1024 * 1024, // 5 MB max file size
		files: 1,
	},
	fileFilter: (req, file, cb) => {
		const allowedMimes = [
			"image/jpeg",
			"image/png",
			"image/webp",
			"application/pdf",
		];
		if (allowedMimes.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(
				new Error(
					"Invalid file type. Only JPG, PNG, WEBP, and PDF documents are allowed.",
				),
				false,
			);
		}
	},
});

module.exports = upload;
