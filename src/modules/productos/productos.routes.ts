import { Router } from 'express';
import multer from 'multer';
import * as productosController from './productos.controller';

const router = Router();

// RF-INV-10: multer guarda el archivo subido en memoria (no en disco), ya que
// de ahí se reenvía directamente a Supabase Storage sin necesitar persistirlo
// localmente en el servidor.
const subidaFoto = multer({ storage: multer.memoryStorage() });

// GET  /productos                 -> RF-INV-04, RF-INV-05 (listar con búsqueda/filtros)
// GET  /productos/filtros         -> valores disponibles para talla/color/categoría
// GET  /productos/:id             -> obtener un producto
// POST /productos                 -> RF-INV-01 (registrar producto)
// PUT  /productos/:id             -> RF-INV-02 (editar producto)
// PATCH /productos/:id/desactivar -> RF-INV-03 (desactivar producto)
// POST /productos/:id/entradas    -> RF-INV-06 (registrar entrada de inventario)
// GET  /productos/:id/movimientos -> RF-INV-09 (historial de movimientos)
// POST /productos/:id/foto        -> RF-INV-10 (subir/reemplazar la foto del producto)

router.get('/', productosController.listar);
router.get('/filtros', productosController.obtenerFiltros);
router.get('/:id', productosController.obtenerUno);
router.post('/', productosController.crear);
router.put('/:id', productosController.actualizar);
router.patch('/:id/desactivar', productosController.desactivar);
router.post('/:id/entradas', productosController.registrarEntrada);
router.get('/:id/movimientos', productosController.obtenerMovimientos);
router.post('/:id/foto', subidaFoto.single('foto'), productosController.subirFoto);

export default router;
