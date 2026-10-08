import bcrypt from 'bcryptjs';
import { FakeDb, limpiarBaseDeDatos } from '../../test-utils/fakePrisma';

jest.mock('../../config/prisma', () => {
  const { crearBaseDeDatosVacia, crearFakePrisma } = require('../../test-utils/fakePrisma');
  const db = crearBaseDeDatosVacia();
  return { prisma: crearFakePrisma(db), __fakeDb: db };
});

import * as authService from './auth.service';
import { verificarToken } from '../../utils/jwt';

const { __fakeDb } = jest.requireMock('../../config/prisma') as { __fakeDb: FakeDb };
const db = __fakeDb;

beforeEach(async () => {
  limpiarBaseDeDatos(db);
  db.usuarios.push({
    id: 1,
    usuario: 'tienda.ropa',
    contrasenaHash: await bcrypt.hash('1234abcd', 10),
    nombreNegocio: 'Mi tienda de ropa',
    preguntaSeguridad: '¿Cuál es el nombre de tu primera mascota?',
    respuestaSeguridadHash: await bcrypt.hash('firulais', 10),
    tokenVersion: 1,
  });
});

describe('iniciarSesion', () => {
  it('retorna un token de acceso y uno de refresco con credenciales correctas', async () => {
    const resultado = await authService.iniciarSesion('tienda.ropa', '1234abcd');

    expect(resultado.token).toBeTruthy();
    expect(resultado.refreshToken).toBeTruthy();
    expect(resultado.token).not.toBe(resultado.refreshToken);

    const payloadAcceso = verificarToken(resultado.token);
    expect(payloadAcceso.tipo).toBe('acceso');
    const payloadRefresco = verificarToken(resultado.refreshToken);
    expect(payloadRefresco.tipo).toBe('refresco');
  });

  it('rechaza una contraseña incorrecta', async () => {
    await expect(authService.iniciarSesion('tienda.ropa', 'clave-equivocada')).rejects.toThrow(
      'Usuario o contraseña incorrectos'
    );
  });

  it('rechaza un usuario que no existe', async () => {
    await expect(authService.iniciarSesion('no.existe', 'cualquiera')).rejects.toThrow(
      'Usuario o contraseña incorrectos'
    );
  });
});

describe('refrescarToken', () => {
  it('emite un nuevo token de acceso a partir de un token de refresco válido', async () => {
    const { refreshToken } = await authService.iniciarSesion('tienda.ropa', '1234abcd');

    const resultado = await authService.refrescarToken(refreshToken);

    expect(resultado.token).toBeTruthy();
    expect(verificarToken(resultado.token).tipo).toBe('acceso');
  });

  it('rechaza un token de ACCESO usado donde se espera uno de refresco', async () => {
    const { token } = await authService.iniciarSesion('tienda.ropa', '1234abcd');

    await expect(authService.refrescarToken(token)).rejects.toThrow('no es un token de refresco válido');
  });

  it('rechaza el refresco si el usuario ya cerró esa sesión (tokenVersion desactualizado)', async () => {
    const { refreshToken } = await authService.iniciarSesion('tienda.ropa', '1234abcd');

    await authService.cerrarOtrasSesiones(1);

    await expect(authService.refrescarToken(refreshToken)).rejects.toThrow('La sesión ya no es válida');
  });

  it('rechaza un token de refresco con formato inválido', async () => {
    await expect(authService.refrescarToken('esto-no-es-un-jwt')).rejects.toThrow();
  });
});

describe('cerrarOtrasSesiones', () => {
  it('incrementa tokenVersion, invalidando los tokens emitidos antes', async () => {
    expect(db.usuarios[0].tokenVersion).toBe(1);

    await authService.cerrarOtrasSesiones(1);

    expect(db.usuarios[0].tokenVersion).toBe(2);
  });
});

describe('actualizarNombreNegocio', () => {
  it('actualiza el nombre del negocio del usuario', async () => {
    const resultado = await authService.actualizarNombreNegocio(1, 'Closet de María');

    expect(resultado.nombreNegocio).toBe('Closet de María');
    expect(db.usuarios[0].nombreNegocio).toBe('Closet de María');
  });

  it('recorta espacios al inicio y al final', async () => {
    const resultado = await authService.actualizarNombreNegocio(1, '   Mi tienda   ');
    expect(resultado.nombreNegocio).toBe('Mi tienda');
  });

  it('rechaza un nombre vacío o compuesto solo de espacios', async () => {
    await expect(authService.actualizarNombreNegocio(1, '')).rejects.toThrow('no puede estar vacío');
    await expect(authService.actualizarNombreNegocio(1, '   ')).rejects.toThrow('no puede estar vacío');
  });

  it('rechaza un nombre de más de 100 caracteres', async () => {
    const nombreLargo = 'a'.repeat(101);
    await expect(authService.actualizarNombreNegocio(1, nombreLargo)).rejects.toThrow('100 caracteres');
  });
});

describe('restablecerContrasena', () => {
  it('invalida las sesiones existentes al cambiar la contraseña', async () => {
    const { refreshToken } = await authService.iniciarSesion('tienda.ropa', '1234abcd');

    await authService.restablecerContrasena('tienda.ropa', 'firulais', 'nuevaClaveSegura');

    // El token de refresco emitido antes del cambio ya no debe servir.
    await expect(authService.refrescarToken(refreshToken)).rejects.toThrow('La sesión ya no es válida');

    // Y la nueva contraseña sí debe funcionar para iniciar sesión.
    const resultado = await authService.iniciarSesion('tienda.ropa', 'nuevaClaveSegura');
    expect(resultado.token).toBeTruthy();
  });

  it('rechaza una respuesta de seguridad incorrecta', async () => {
    await expect(
      authService.restablecerContrasena('tienda.ropa', 'respuesta-equivocada', 'nuevaClaveSegura')
    ).rejects.toThrow('respuesta de seguridad no es correcta');
  });
});
