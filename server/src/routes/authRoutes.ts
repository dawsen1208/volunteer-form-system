import { Router } from "express";

import { loginUserController } from "../controllers/authController";

export const authRoutes = Router();

authRoutes.post("/login", loginUserController);
