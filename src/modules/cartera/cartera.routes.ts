import { Router } from 'express';
import * as carteraController from './cartera.controller';

const router = Router();

// GET  /cartera                    -> RF-CAR-07 (listado general de cartera)
// GET  /cartera/clientes           -> listar clientes
// POST /cartera/clientes           -> RF-CAR-01 (registrar cliente)
// GET  /cartera/clientes/:id       -> obtener un cliente
// PUT  /cartera/clientes/:id       -> RF-CAR-02 (editar cliente)
// DELETE /cartera/clientes/:id     -> RF-CAR-02 (eliminar cliente)
// GET  /cartera/clientes/:id/saldo -> RF-CAR-05 (saldo pendiente)
// GET  /cartera/clientes/:id/ventas -> RF-CAR-03 (ventas a crédito del cliente)
// GET  /cartera/clientes/:id/abonos -> RF-CAR-06 (historial de abonos)
// POST /cartera/clientes/:id/abonos -> RF-CAR-04, RF-CAR-08 (registrar abono)

router.get('/', carteraController.carteraGeneral);
router.get('/clientes', carteraController.listarClientes);
router.post('/clientes', carteraController.crearCliente);
router.get('/clientes/:id', carteraController.obtenerCliente);
router.put('/clientes/:id', carteraController.actualizarCliente);
router.delete('/clientes/:id', carteraController.eliminarCliente);
router.get('/clientes/:id/saldo', carteraController.saldoCliente);
router.get('/clientes/:id/ventas', carteraController.ventasCliente);
router.get('/clientes/:id/abonos', carteraController.historialAbonos);
router.post('/clientes/:id/abonos', carteraController.registrarAbono);

export default router;
