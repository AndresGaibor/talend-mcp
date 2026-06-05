import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";

type SnippetSection = "diseno" | "contextos" | "validaciones" | "errores" | "tiempo" | "evidencias";

interface SnippetCardProps {
  section: SnippetSection;
  label: string;
  description: string;
  content?: string;
  isLoading: boolean;
  isCopied: boolean;
  onGenerate: () => void;
  onCopy: () => void;
}

export function SnippetCard({
  label,
  description,
  content,
  isLoading,
  isCopied,
  onGenerate,
  onCopy,
}: SnippetCardProps) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{label}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
        {content && <Badge variant="success">Generado</Badge>}
      </div>

      {content ? (
        <div className="mb-3">
          <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-md max-h-48 overflow-y-auto font-mono">
            {content}
          </pre>
        </div>
      ) : (
        <div className="mb-3 min-h-[80px] flex items-center justify-center border border-dashed border-gray-200 rounded-md">
          <p className="text-xs text-gray-400">Sin contenido generado</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={onGenerate}
          disabled={isLoading}
          variant="primary"
          size="sm"
          className="flex-1"
        >
          {isLoading ? "..." : "Generar"}
        </Button>
        {content && (
          <Button
            onClick={onCopy}
            variant={isCopied ? "primary" : "secondary"}
            size="sm"
          >
            {isCopied ? "Copiado!" : "Copiar"}
          </Button>
        )}
      </div>
    </div>
  );
}