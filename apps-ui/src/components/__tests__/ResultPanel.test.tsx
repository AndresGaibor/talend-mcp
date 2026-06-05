import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResultPanel } from '../ResultPanel';

describe('ResultPanel', () => {
  it('renderiza correctamente sin titulo', () => {
    render(<ResultPanel>Contenido del panel</ResultPanel>);
    expect(screen.getByText('Contenido del panel')).toBeInTheDocument();
  });

  it('renderiza con titulo cuando se provee', () => {
    render(<ResultPanel title="Mi Titulo">Contenido</ResultPanel>);
    expect(screen.getByText('Mi Titulo')).toBeInTheDocument();
    expect(screen.getByText('Contenido')).toBeInTheDocument();
  });

  it('no renderiza header cuando no hay titulo', () => {
    const { container } = render(<ResultPanel>Contenido</ResultPanel>);
    expect(container.querySelector('.border-b')).not.toBeInTheDocument();
  });

  it('aplica estilos base correctamente', () => {
    const { container } = render(<ResultPanel>Test</ResultPanel>);
    expect(container.firstChild).toHaveClass('bg-white');
    expect(container.firstChild).toHaveClass('rounded-lg');
    expect(container.firstChild).toHaveClass('border');
    expect(container.firstChild).toHaveClass('border-gray-200');
  });

  it('renderiza con clase CSS personalizada', () => {
    const { container } = render(
      <ResultPanel className="clase-personalizada" title="Test">Contenido</ResultPanel>
    );
    expect(container.firstChild).toHaveClass('clase-personalizada');
  });

  it('renderiza hijos dentro del area de contenido', () => {
    const { container } = render(
      <ResultPanel>
        <span data-testid="contenido">Texto interior</span>
      </ResultPanel>
    );
    const contenido = container.querySelector('[data-testid="contenido"]');
    expect(contenido).toBeInTheDocument();
  });
});