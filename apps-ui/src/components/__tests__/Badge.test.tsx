import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../Badge';

describe('Badge', () => {
  it('renderiza correctamente con texto', () => {
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText('Test Badge')).toBeInTheDocument();
  });

  it('renderiza con variant default por defecto', () => {
    const { container } = render(<Badge>Default</Badge>);
    expect(container.firstChild).toHaveClass('bg-gray-100');
  });

  it('renderiza con variant success', () => {
    const { container } = render(<Badge variant="success">Success</Badge>);
    expect(container.firstChild).toHaveClass('bg-green-100');
  });

  it('renderiza con variant error', () => {
    const { container } = render(<Badge variant="error">Error</Badge>);
    expect(container.firstChild).toHaveClass('bg-red-100');
  });

  it('renderiza con variant warning', () => {
    const { container } = render(<Badge variant="warning">Warning</Badge>);
    expect(container.firstChild).toHaveClass('bg-yellow-100');
  });

  it('aplica classes personalizadas', () => {
    const { container } = render(<Badge className="custom-class">Custom</Badge>);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});