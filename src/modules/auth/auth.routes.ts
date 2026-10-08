import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { autenticar } from '../../middleware/auth.middleware';
import * as authController from './auth.controller';

const router = Router();

// Seguridad: limita los intentos por IP a las rutas que permiten adivinar una
// contraseña o una respuesta de seguridad, mitigando ataques de fuerza bruta
// (quedó documentado como pendiente en la Política de Seguridad del proyecto).
const limitadorIntentos = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
});

// POST /auth/login  (RF-USR-01)
router.post('/login', limitadorIntentos, authController.login);

// GET  /auth/pregunta-seguridad?usuario=  (RF-USR-03, paso 1)
router.get('/pregunta-seguridad', limitadorIntentos, authController.preguntaSeguridad);

// POST /auth/restablecer-contrasena  (RF-USR-03, paso 2)
router.post('/restablecer-contrasena', limitadorIntentos, authController.restablecerContrasena);

// POST /auth/refrescar  (Seguridad: renovar el token de acceso)
router.post('/refrescar', authController.refrescar);

// POST /auth/cerrar-otras-sesiones  (Seguridad: invalidar otras sesiones activas)
router.post('/cerrar-otras-sesiones', autenticar, authController.cerrarOtrasSesiones);

// PUT /auth/nombre-negocio  (US-USR-04: registrar/actualizar el nombre del negocio)
router.put('/nombre-negocio', autenticar, authController.actualizarNombreNegocio);

export default router;
