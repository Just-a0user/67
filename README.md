# Text zu Handschrift (für GoodNotes)

Web-App für den iPad-Browser, keine Installation nötig. Du schreibst deine eigene Handschrift mit dem Apple Pencil ein, fügst Text ein und exportierst jeden Buchstaben (oder jedes Wort) als eigenes transparentes PNG. In GoodNotes lassen sich die Teile einzeln verschieben.

## Starten

1. Im Repo auf GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**.
2. Auf dem iPad `https://just-a0user.github.io/67/` in Safari öffnen.
3. Optional: Teilen → **Zum Home-Bildschirm**.

## Benutzung

1. **Schrift aufnehmen:** Zeichen wählen, mit dem Pencil schreiben, „Als Variante speichern". Pro Zeichen mindestens 3 Varianten aufnehmen (A–Z, a–z, ÄÖÜäöüß, 0–9, Satzzeichen). Auf der blauen Linie schreiben, sie ist die Grundlinie.
2. **Text & Export:** Text einfügen. Mit „Variation" regelst du, wie stark jeder Buchstabe zufällig gekippt, skaliert, verschoben und leicht verwackelt wird. Zusätzlich wird pro Buchstabe zufällig eine der aufgenommenen Varianten gewählt, nie zweimal dieselbe hintereinander.
3. **Einzelteile erzeugen**, dann:
   - **Teilen / In Fotos sichern**: In GoodNotes über *Einfügen → Foto* mehrere Bilder auswählen.
   - **ZIP herunterladen**: In der Dateien-App entpacken, die PNGs in GoodNotes einfügen.
   - Alternativ GoodNotes im Split View öffnen und die Bilder aus der Vorschau per Drag & Drop hineinziehen.

Alle Buchstaben-PNGs haben dieselbe Höhe und dieselbe Grundlinie, damit sie sich leicht ausrichten lassen.

## Hinweise

- Die Handschrift wird im Browser gespeichert (localStorage). Safari und die Home-Bildschirm-App haben getrennte Speicher. Mit „Handschrift sichern" bzw. „Handschrift laden" kannst du sie übertragen.
- Ein direkter `.goodnotes`-Export ist nicht enthalten. Das Format ist nicht dokumentiert und lässt sich ohne GoodNotes nicht prüfen.
- Dateien: `index.html`, `style.css`, `app.js` (Aufnahme, Rendering, Export), `zip.js` (kleiner ZIP-Writer).
