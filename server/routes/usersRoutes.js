const express = require("express");
const router = express.Router();
const usersController = require("../controllers/usersController");
const upload = require("../middleware/upload");

router.post("/", usersController.createUser);
router.get("/", usersController.getUsers);
router.get("/:custom_id", usersController.getUserByCustomId);
router.put("/:id", upload.single("photo"), usersController.updateUser);
router.delete("/:id", usersController.deleteUser);

module.exports = router;
