/** Configuración de Jest para las pruebas del backend (TypeScript vía ts-jest). */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  clearMocks: true,
  // isolatedModules: transpila sin verificar tipos en cada archivo de forma aislada.
  // Se usa aquí porque las pruebas dependen de los tipos generados por Prisma
  // (npx prisma generate), que solo existen tras conectarse a una base de datos
  // real; en tiempo de ejecución las pruebas no necesitan esos tipos, ya que
  // sustituyen el cliente de Prisma real por un doble en memoria (ver
  // src/test-utils/fakePrisma.ts). La verificación de tipos del proyecto se
  // sigue haciendo por separado con "npm run build".
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true }],
  },
  collectCoverageFrom: [
    'src/modules/**/*.service.ts',
    'src/utils/**/*.ts',
    '!src/**/*.test.ts',
  ],
};
