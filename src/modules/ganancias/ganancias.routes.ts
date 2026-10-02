import { Router } from 'express';
import * as gananciasController from './ganancias.controller';

const router = Router();

// GET /ganancias/resumen?desde=&hasta=      -> RF-GAN-03, RF-GAN-06 (resumen del periodo)
// GET /ganancias/por-producto?desde=&hasta= -> RF-GAN-04 (ganancia por producto)
// GET /ganancias/proyeccion                 -> RF-GAN-05 (proyección del inventario)
// GET /ganancias/iva?desde=&hasta=          -> IVA generado en el periodo

router.get('/resumen', gananciasController.resumen);
router.get('/por-producto', gananciasController.porProducto);
router.get('/proyeccion', gananciasController.proyeccionInventario);
router.get('/iva', gananciasController.resumenIva);

export default router;
