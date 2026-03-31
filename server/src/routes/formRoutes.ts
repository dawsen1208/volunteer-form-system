import { Router } from "express";

import { createFormController, submitFormController } from "../controllers/formController";
import { authMiddleware } from "../middleware/authMiddleware";

export const formRoutes = Router();

formRoutes.post("/", authMiddleware, createFormController);
formRoutes.post("/:id/submit", authMiddleware, submitFormController);

