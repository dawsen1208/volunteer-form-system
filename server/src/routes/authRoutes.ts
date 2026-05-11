import { Router } from "express";

import { loginUserController, resetPasswordController } from "../controllers/authController";

export const authRoutes = Router();

authRoutes.post("/login", loginUserController);
authRoutes.post("/reset-password", resetPasswordController);
