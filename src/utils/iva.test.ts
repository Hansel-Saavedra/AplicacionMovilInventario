import { descomponerIva, TASA_IVA_GENERAL } from './iva';

describe('descomponerIva', () => {
  it('descompone $40.000 en base e IVA que suman exactamente el total (ejemplo del docente)', () => {
    const resultado = descomponerIva(40000);

    expect(resultado.valorTotal).toBe(40000);
    // Redondeo a 2 decimales: 40000 / 1.19 = 33613.445...
    expect(resultado.valorBase).toBeCloseTo(33613.45, 2);
    expect(resultado.valorIva).toBeCloseTo(6386.55, 2);
    // La propiedad más importante: base + IVA debe ser exactamente el total original.
    expect(resultado.valorBase + resultado.valorIva).toBeCloseTo(40000, 2);
  });

  it('usa la tarifa general del 19% por defecto', () => {
    expect(TASA_IVA_GENERAL).toBe(0.19);
  });

  it('retorna ceros cuando el valor de entrada es cero', () => {
    const resultado = descomponerIva(0);
    expect(resultado).toEqual({ valorBase: 0, valorIva: 0, valorTotal: 0 });
  });

  it('respeta una tarifa distinta si se especifica explícitamente', () => {
    // Con tarifa 0%, toda la base es igual al total y el IVA es cero.
    const resultado = descomponerIva(100000, 0);
    expect(resultado.valorBase).toBe(100000);
    expect(resultado.valorIva).toBe(0);
  });

  it('produce resultados consistentes para varios valores típicos de productos de ropa', () => {
    const casos = [45000, 98000, 130000, 25000];
    for (const valor of casos) {
      const resultado = descomponerIva(valor);
      expect(resultado.valorBase + resultado.valorIva).toBeCloseTo(valor, 2);
      expect(resultado.valorBase).toBeGreaterThan(0);
      expect(resultado.valorIva).toBeGreaterThan(0);
    }
  });
});
