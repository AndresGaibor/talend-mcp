import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from '../Card';

describe('Card', () => {
  it('renderiza correctamente con hijos', () => {
    render(<Card>Contenido del card</Card>);
    expect(screen.getByText('Contenido del card')).toBeInTheDocument();
  });

  it('renderiza con clase CSS personalizada', () => {
    const { container } = render(<Card className="mi-clase-personalizada">Test</Card>);
    expect(container.firstChild).toHaveClass('mi-clase-personalizada');
  });

  it('aplica estilos base correctamente', () => {
    const { container } = render(<Card>Test</Card>);
    expect(container.firstChild).toHaveClass('bg-white');
    expect(container.firstChild).toHaveClass('rounded-lg');
    expect(container.firstChild).toHaveClass('shadow-sm');
    expect(container.firstChild).toHaveClass('border');
    expect(container.firstChild).toHaveClass('border-gray-200');
  });

  it('renderiza múltiples elementos hijos', () => {
    render(
      <Card>
        <span>Hijo 1</span>
        <span>Hijo 2</span>
      </Card>
    );
    expect(screen.getByText('Hijo 1')).toBeInTheDocument();
    expect(screen.getByText('Hijo 2')).toBeInTheDocument();
  });
});