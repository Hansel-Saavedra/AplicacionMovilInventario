import { Router } from 'express';
import * as productosController from './productos.controller';

const router = Router();

// GET  /productos                 -> RF-INV-04, RF-INV-05 (listar con búsqueda/filtros)
// GET  /productos/filtros         -> valores disponibles para talla/color/categoría
// GET  /productos/:id             -> obtener un producto
// POST /productos                 -> RF-INV-01 (registrar producto)
// PUT  /productos/:id             -> RF-INV-02 (editar producto)
// PATCH /productos/:id/desactivar -> RF-INV-03 (desactivar producto)
// POST /productos/:id/entradas    -> RF-INV-06 (registrar entrada de inventario)
// GET  /productos/:id/movimientos -> RF-INV-09 (historial de movimientos)

router.get('/', productosController.listar);
router.get('/filtros', productosController.obtenerFiltros);
router.get('/:id', productosController.obtenerUno);
router.post('/', productosController.crear);
router.put('/:id', productosController.actualizar);
router.patch('/:id/desactivar', productosController.desactivar);
router.post('/:id/entradas', productosController.registrarEntrada);
router.get('/:id/movimientos', productosController.obtenerMovimientos);

export default router;
