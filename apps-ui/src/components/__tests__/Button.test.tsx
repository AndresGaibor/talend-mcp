import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('renderiza correctamente con texto', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('renderiza con variant primary por defecto', () => {
    const { container } = render(<Button>Primary</Button>);
    expect(container.firstChild).toHaveClass('bg-blue-600');
  });

  it('renderiza con variant secondary', () => {
    const { container } = render(<Button variant="secondary">Secondary</Button>);
    expect(container.firstChild).toHaveClass('bg-gray-600');
  });

  it('renderiza con size sm', () => {
    const { container } = render(<Button size="sm">Small</Button>);
    expect(container.firstChild).toHaveClass('px-3');
  });

  it('renderiza con size lg', () => {
    const { container } = render(<Button size="lg">Large</Button>);
    expect(container.firstChild).toHaveClass('px-6');
  });

  it('aplica classes personalizadas', () => {
    const { container } = render(<Button className="custom-class">Custom</Button>);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});