// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.

/**
 * The words this package's own components say.
 *
 * I18N IS NOT A SEAM, and that is the whole reason this file exists. `UiDataTable`, `KanbanCore`,
 * `FieldInput` and `WeeklyHours` call `useI18n()` directly, so a host that installs the package
 * without these keys does not get an error — vue-i18n renders the key PATH. The symptom is a
 * toolbar button labelled `table.expandAll`, which looks like a typo rather than a missing
 * dependency, and which no test on the host side would think to look for.
 *
 * So the keys travel with the components that say them. A host deep-merges this UNDER its own
 * catalog, which means an application that wants different words simply says them and wins.
 *
 * German is here for the same reason English is: a package that shipped only `en` would give a
 * German application English table chrome, and the gap would show up in exactly one place nobody
 * runs — somebody else's language.
 */

export const messages = {
  "en": {
    "common": {
      "actions": "Actions",
      "cancel": "Cancel",
      "delete": "Delete",
      "edit": "Edit"
    },
    "runtime": {
      "board": {
        "moveNeedsAction": "That move needs an action that is not available.",
        "needsGroup": "This board needs a select or reference field to group by."
      },
      "hours": {
        "addDate": "Add date",
        "addWindow": "Add another range",
        "closed": "Not available",
        "closedAllDay": "Closed all day",
        "copyToAll": "Copy these hours to every open day",
        "emptyWarning": "No hours set — Mon–Fri, 09:00–17:00 is used until you set some.",
        "exceptions": "Specific dates",
        "label": "When people can book",
        "useDefault": "Use Mon–Fri, 09:00–17:00"
      },
      "validation": {
        "email": "Enter a valid email",
        "integer": "Must be a whole number",
        "number": "Must be a number",
        "url": "Enter a valid URL (https://…)"
      }
    },
    "table": {
      "addSection": "Add section…",
      "clearAll": "Clear all",
      "collapseAll": "Collapse all",
      "comfortable": "Comfortable",
      "compact": "Compact",
      "convertToTopLevel": "Move to top level",
      "dragToMove": "Drag to move",
      "expandAll": "Expand all",
      "move": "Move",
      "moveToSection": "Move to section",
      "parentTask": "Parent task"
    }
  },
  "de": {
    "common": {
      "actions": "Aktionen",
      "cancel": "Abbrechen",
      "delete": "Löschen",
      "edit": "Bearbeiten"
    },
    "runtime": {
      "board": {
        "moveNeedsAction": "Dieser Zug erfordert eine Aktion, die nicht verfügbar ist.",
        "needsGroup": "Dieses Board braucht ein Auswahl- oder Verweisfeld zum Gruppieren."
      },
      "hours": {
        "addDate": "Datum hinzufügen",
        "addWindow": "Weiteren Zeitraum hinzufügen",
        "closed": "Nicht verfügbar",
        "closedAllDay": "Ganztägig geschlossen",
        "copyToAll": "Diese Zeiten auf alle offenen Tage übertragen",
        "emptyWarning": "Keine Zeiten gesetzt — bis dahin gilt Mo–Fr, 09:00–17:00.",
        "exceptions": "Einzelne Tage",
        "label": "Wann gebucht werden kann",
        "useDefault": "Mo–Fr, 09:00–17:00 verwenden"
      },
      "validation": {
        "email": "Geben Sie eine gültige E-Mail-Adresse ein",
        "integer": "Muss eine ganze Zahl sein",
        "number": "Muss eine Zahl sein",
        "url": "Geben Sie eine gültige URL ein (https://…)"
      }
    },
    "table": {
      "addSection": "Abschnitt hinzufügen…",
      "clearAll": "Alles zurücksetzen",
      "collapseAll": "Alle einklappen",
      "comfortable": "Komfortabel",
      "compact": "Kompakt",
      "convertToTopLevel": "Auf oberste Ebene verschieben",
      "dragToMove": "Zum Verschieben ziehen",
      "expandAll": "Alle ausklappen",
      "move": "Verschieben",
      "moveToSection": "In Abschnitt verschieben",
      "parentTask": "Übergeordnete Aufgabe"
    }
  }
}
