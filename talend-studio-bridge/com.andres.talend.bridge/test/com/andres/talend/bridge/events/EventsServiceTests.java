package com.andres.talend.bridge.events;

import static com.andres.talend.bridge.TestSupport.check;

import java.util.List;
import java.util.Map;

import org.eclipse.jface.viewers.ISelection;

/**
 * El historial de eventos es un buffer circular de 100 entradas, pero el texto
 * de cada entrada no tenia tope: seleccionar miles de filas guardaba la
 * seleccion entera en memoria.
 */
public final class EventsServiceTests {
  private EventsServiceTests() {}

  public static void run() throws Exception {
    EventsService.clear();

    String grande = "x".repeat(5_000);
    ISelection seleccionGrande = new ISelection() {
      @Override
      public boolean isEmpty() {
        return false;
      }

      @Override
      public String toString() {
        return grande;
      }
    };
    new EventsService().selectionChanged(null, seleccionGrande);

    List<Map<String, Object>> eventos = eventosDe(EventsService.recent());
    check(eventos.size() == 1, "la seleccion se registra como un evento");
    String texto = (String) datosDe(eventos.get(0)).get("selectionText");
    check(texto.length() < grande.length(), "el texto de la seleccion se recorta");
    check(texto.endsWith("..."), "el recorte de la seleccion se nota");
    check(texto.length() <= 503, "el recorte de la seleccion respeta el tope (mide " + texto.length() + ")");

    EventsService.clear();
    ISelection seleccionCorta = new ISelection() {
      @Override
      public boolean isEmpty() {
        return false;
      }

      @Override
      public String toString() {
        return "fila 1";
      }
    };
    new EventsService().selectionChanged(null, seleccionCorta);
    String corto = (String) datosDe(eventosDe(EventsService.recent()).get(0)).get("selectionText");
    check("fila 1".equals(corto), "una seleccion normal se guarda entera");

    EventsService.clear();
  }

  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> eventosDe(Map<String, Object> payload) {
    return (List<Map<String, Object>>) payload.get("events");
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> datosDe(Map<String, Object> evento) {
    return (Map<String, Object>) evento.get("data");
  }
}
