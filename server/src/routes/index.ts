import { Router } from "express";

import { adminRoutes } from "./adminRoutes";
import { authRoutes } from "./authRoutes";
import { healthRoutes } from "./healthRoutes";

export const apiRoutes = Router();

apiRoutes.use(healthRoutes);
apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/admin", adminRoutes);
