import { Router } from 'express';
import * as authController from './auth.controller';

const router = Router();

// POST /auth/login  (RF-USR-01)
router.post('/login', authController.login);

// GET  /auth/pregunta-seguridad?usuario=  (RF-USR-03, paso 1)
router.get('/pregunta-seguridad', authController.preguntaSeguridad);

// POST /auth/restablecer-contrasena  (RF-USR-03, paso 2)
router.post('/restablecer-contrasena', authController.restablecerContrasena);

export default router;
