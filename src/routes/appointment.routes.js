import { Router } from "express";
import * as appointmentController from "../controller/appointment.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", authenticate, appointmentController.findAll);
router.post("/", authenticate, appointmentController.create);
router.put("/:id", authenticate, appointmentController.update);
router.get("/:id", authenticate, appointmentController.findById);
router.delete("/:id", authenticate, appointmentController.destroy);
router.patch("/:id/cancel", authenticate, appointmentController.cancel);

export default router;
