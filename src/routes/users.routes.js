import { Router } from "express";
import * as userController from "../controller/users.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", authenticate, userController.findAll);
router.post("/", authenticate, userController.create);
router.put("/:id", authenticate, userController.update);
router.get("/:id", authenticate, userController.findById);
router.delete("/:id", authenticate, userController.destroy);

export default router;