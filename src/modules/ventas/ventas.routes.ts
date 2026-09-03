import { Router } from 'express';
import * as ventasController from './ventas.controller';

const router = Router();

// GET  /ventas          -> RF-VEN-05 (historial de ventas)
// POST /ventas          -> RF-VEN-01, RF-VEN-02, RF-VEN-03, RF-VEN-04 (registrar venta)
// PATCH /ventas/:id/anular -> RF-VEN-06 (anular venta)

router.get('/', ventasController.listar);
router.post('/', ventasController.crear);
router.patch('/:id/anular', ventasController.anular);

export default router;
