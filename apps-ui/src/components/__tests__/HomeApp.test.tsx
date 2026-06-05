import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { HomeApp } from '../../apps/home/HomeApp';
import * as useCallToolModule from '../../openai/useCallTool';

vi.mock('../../openai/useCallTool');

describe('HomeApp', () => {
  const mockExecute = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    (useCallToolModule.useCallTool as ReturnType<typeof vi.fn>).mockReturnValue({
      execute: mockExecute,
      isLoading: false,
      error: null,
      result: null,
    });
  });

  it('renderiza sin lanzar errores', async () => {
    mockExecute.mockResolvedValue({ success: false, error: 'Connection failed' });

    await act(async () => {
      expect(() => render(<HomeApp />)).not.toThrow();
    });
  });

  it('muestra el titulo principal Home', async () => {
    mockExecute.mockResolvedValue({ success: false, error: 'Connection failed' });
    await act(async () => {
      render(<HomeApp />);
    });
    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
  });

  it('muestra el subtitulo Dashboard overview', async () => {
    mockExecute.mockResolvedValue({ success: false, error: 'Connection failed' });
    await act(async () => {
      render(<HomeApp />);
    });
    expect(screen.getByText('Dashboard overview')).toBeInTheDocument();
  });

  it('renderiza el boton Refresh', async () => {
    mockExecute.mockResolvedValue({ success: false, error: 'Connection failed' });
    await act(async () => {
      render(<HomeApp />);
    });
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('renderiza las tarjetas de estado', async () => {
    mockExecute.mockResolvedValue({ success: false, error: 'Connection failed' });
    await act(async () => {
      render(<HomeApp />);
    });
    await waitFor(() => {
      expect(screen.getByText('Bridge Status')).toBeInTheDocument();
      expect(screen.getByText('Studio Status')).toBeInTheDocument();
      expect(screen.getByText('Environment')).toBeInTheDocument();
      expect(screen.getByText('Project')).toBeInTheDocument();
    });
  });

  it('renderiza las acciones rapidas', async () => {
    mockExecute.mockResolvedValue({ success: false, error: 'Connection failed' });
    await act(async () => {
      render(<HomeApp />);
    });
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
  });

  it('renderiza la seccion de aplicaciones recomendadas', async () => {
    mockExecute.mockResolvedValue({ success: false, error: 'Connection failed' });
    await act(async () => {
      render(<HomeApp />);
    });
    expect(screen.getByText('Recommended Apps')).toBeInTheDocument();
  });

  it('muestra las aplicaciones recomendadas con descripciones', async () => {
    mockExecute.mockResolvedValue({ success: false, error: 'Connection failed' });
    await act(async () => {
      render(<HomeApp />);
    });

    const jobsCard = screen.getByRole('button', { name: /Manage and run Talend jobs/i });
    expect(jobsCard).toBeInTheDocument();
    expect(jobsCard).toHaveTextContent('Jobs');

    const problemsCard = screen.getByRole('button', { name: /View and resolve issues/i });
    expect(problemsCard).toBeInTheDocument();
    expect(problemsCard).toHaveTextContent('Problems');

    const snapshotsCard = screen.getByRole('button', { name: /Manage snapshots/i });
    expect(snapshotsCard).toBeInTheDocument();
    expect(snapshotsCard).toHaveTextContent('Snapshots');
  });
});