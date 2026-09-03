import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { autenticar } from './middleware/auth.middleware';
import { manejadorErrores } from './middleware/error.middleware';
import authRoutes from './modules/auth/auth.routes';
import carteraRoutes from './modules/cartera/cartera.routes';
import gananciasRoutes from './modules/ganancias/ganancias.routes';
import productosRoutes from './modules/productos/productos.routes';
import ventasRoutes from './modules/ventas/ventas.routes';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Ruta pública, útil para confirmar que el servicio está desplegado y activo.
app.get('/', (_req, res) => {
  res.json({ mensaje: 'API de Inventario Ropa activa', version: '1.0.0' });
});

// Rutas públicas.
app.use('/auth', authRoutes);

// A partir de aquí, todas las rutas exigen un token JWT válido (RF-USR-01, RF-USR-02).
app.use('/productos', autenticar, productosRoutes);
app.use('/ventas', autenticar, ventasRoutes);
app.use('/cartera', autenticar, carteraRoutes);
app.use('/ganancias', autenticar, gananciasRoutes);

// Middleware de manejo de errores: siempre debe ir al final.
app.use(manejadorErrores);

export default app;
