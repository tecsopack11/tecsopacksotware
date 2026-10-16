"""Generate editable count templates from the supplied catalog; no stock is assumed."""

import json
from pathlib import Path
from xml.etree import ElementTree
from xml.sax.saxutils import escape
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
CATALOG = json.loads((ROOT / "lib/products/generic-catalog.json").read_text())
OUTPUT = ROOT / "entregables"
OUTPUT.mkdir(exist_ok=True)
NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL = "http://schemas.openxmlformats.org/package/2006/relationships"


def archive(path, entries):
    with ZipFile(path, "w", ZIP_DEFLATED) as package:
        for name, content in entries.items():
            ElementTree.fromstring(content)
            package.writestr(name, content)
    with ZipFile(path) as package:
        assert package.testzip() is None


def cell(ref, value=None, style=0):
    if value is None:
        return f'<c r="{ref}" s="{style}"/>'
    if isinstance(value, (int, float)):
        return f'<c r="{ref}" s="{style}"><v>{value}</v></c>'
    return f'<c r="{ref}" s="{style}" t="inlineStr"><is><t>{escape(value)}</t></is></c>'


headers = ["FAMILIA", "REFERENCIA", "DISEÑO", "COLOR", "DIMENSIONES", "CALIBRE",
           "UNDS/PAQUETE", "UNDS/BULTO", "EXISTENCIA (UNIDADES)", "PESO REAL (KG), SI SE CONOCE", "OBSERVACIONES"]
rows = [
    '<row r="1">' + cell("A1", "TECSOPACK · CONTEO INICIAL DE PRODUCTO TERMINADO", 1) + '</row>',
    '<row r="2">' + cell("A2", "FECHA:") + cell("D2", "RESPONSABLE:") + cell("H2", "ALMACÉN:") + '</row>',
    '<row r="3">' + cell("A3", "DILIGENCIAR I:K. EXISTENCIA = UNIDADES TOTALES CONTADAS; DEJAR EN BLANCO SI NO SE CONTÓ. CERO SOLO SI SE CONFIRMÓ QUE NO HAY.") + '</row>',
    '<row r="4">' + cell("A4", "PAQUETE Y BULTO SON PRESENTACIONES, NO EXISTENCIAS. NO ESTIMAR KG. UN FORMATO POR ALMACÉN; CONTAR EN LA FECHA INDICADA.") + '</row>',
    '<row r="5">' + ''.join(cell(f"{chr(65+i)}5", value, 1) for i, value in enumerate(headers)) + '</row>',
]
for number, item in enumerate(CATALOG, 6):
    values = [item[k] for k in ("category", "reference", "design", "color", "dimensions", "gauge", "unitsPerPack", "unitsPerBale")]
    rows.append(f'<row r="{number}">' + ''.join(cell(f"{chr(65+i)}{number}", value, 3 if i >= 5 else 0) for i, value in enumerate(values)) + cell(f"I{number}", style=2) + cell(f"J{number}", style=4) + cell(f"K{number}", style=2) + '</row>')
end = len(CATALOG) + 5
sheet = f'''<worksheet xmlns="{NS}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="2" width="18" customWidth="1"/><col min="3" max="3" width="27" customWidth="1"/><col min="4" max="5" width="18" customWidth="1"/><col min="6" max="8" width="17" customWidth="1"/><col min="9" max="10" width="28" customWidth="1"/><col min="11" max="11" width="35" customWidth="1"/></cols><sheetData>{''.join(rows)}</sheetData><autoFilter ref="A5:K{end}"/><dataValidations count="2"><dataValidation type="whole" operator="greaterThanOrEqual" allowBlank="1" showErrorMessage="1" errorTitle="CANTIDAD NO VÁLIDA" error="DIGITA UNIDADES ENTERAS MAYORES O IGUALES A CERO." sqref="I6:I{end}"><formula1>0</formula1></dataValidation><dataValidation type="decimal" operator="greaterThanOrEqual" allowBlank="1" showErrorMessage="1" errorTitle="PESO NO VÁLIDO" error="DIGITA UN PESO MAYOR O IGUAL A CERO." sqref="J6:J{end}"><formula1>0</formula1></dataValidation></dataValidations><printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>'''
styles = f'''<styleSheet xmlns="{NS}"><fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Arial"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF00695C"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1"/></xf><xf numFmtId="3" fontId="0" fillId="3" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="4" fontId="0" fillId="3" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'''
archive(OUTPUT / "TECSOPACK-Conteo-inicial-producto-terminado.xlsx", {
    "[Content_Types].xml": '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    "_rels/.rels": f'<Relationships xmlns="{REL}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml": f'<workbook xmlns="{NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="CONTEO INICIAL PT" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">\'CONTEO INICIAL PT\'!$5:$5</definedName></definedNames></workbook>',
    "xl/_rels/workbook.xml.rels": f'<Relationships xmlns="{REL}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    "xl/styles.xml": styles, "xl/worksheets/sheet1.xml": sheet,
})

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def paragraph(value, bold=False):
    return '<w:p><w:pPr><w:spacing w:after="90"/></w:pPr><w:r>' + ('<w:rPr><w:b/></w:rPr>' if bold else '') + f'<w:t xml:space="preserve">{escape(value)}</w:t></w:r></w:p>'


def table_row(values, header=False):
    return '<w:tr>' + ('<w:trPr><w:tblHeader/></w:trPr>' if header else '') + ''.join('<w:tc><w:tcPr>' + ('<w:shd w:fill="D9EDE7"/>' if header else '') + '</w:tcPr>' + paragraph(str(value), header) + '</w:tc>' for value in values) + '</w:tr>'

body = paragraph("TECSOPACK · CONTEO INICIAL DE PRODUCTO TERMINADO", True)
body += paragraph("FECHA: __________________  RESPONSABLE: __________________  ALMACÉN: __________________")
body += paragraph("Registrar unidades totales contadas. Dejar en blanco si está pendiente; escribir 0 solo si se confirmó que no hay. Un formato por almacén. No estimar pesos en kg.")
body += paragraph("Las 63 variantes provienen de LISTA DE GENERICO.xlsx. Dimensiones y calibre se conservan como aparecen en el archivo; sus unidades están pendientes de confirmar.")
for family in ("LÁMINAS", "BOLSILLOS"):
    body += paragraph(family, True)
    body += '<w:tbl><w:tblPr><w:tblW w:w="14200" w:type="dxa"/><w:tblBorders>' + ''.join(f'<w:{edge} w:val="single" w:sz="4" w:color="BBBBBB"/>' for edge in ('top','left','bottom','right','insideH','insideV')) + '</w:tblBorders></w:tblPr>'
    body += table_row(["REFERENCIA", "DISEÑO", "COLOR", "DIMENSIONES", "CALIBRE", "EXISTENCIA (UNDS)", "PESO REAL (KG)", "OBSERVACIONES"], True)
    for item in CATALOG:
        if item['category'] == family:
            body += table_row([item['reference'],item['design'],item['color'],item['dimensions'],str(item['gauge']).replace('.',','),'','',''])
    body += '</w:tbl>'
body += paragraph("Firma del responsable: ____________________________________")
document = f'<w:document xmlns:w="{W}"><w:body>{body}<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="700" w:right="700" w:bottom="700" w:left="700"/></w:sectPr></w:body></w:document>'
archive(OUTPUT / "TECSOPACK-Conteo-inicial-producto-terminado.docx", {
    "[Content_Types].xml": '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
    "_rels/.rels": f'<Relationships xmlns="{REL}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    "word/_rels/document.xml.rels": f'<Relationships xmlns="{REL}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    "word/document.xml": document,
    "word/styles.xml": f'<w:styles xmlns:w="{W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="18"/><w:lang w:val="es-CO"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>',
})

with ZipFile(OUTPUT / "TECSOPACK-Conteo-inicial-producto-terminado.xlsx") as package:
    sheet_root = ElementTree.fromstring(package.read("xl/worksheets/sheet1.xml"))
    ns = {"s": NS}
    for number in range(6, end + 1):
        for col in ("I", "J", "K"):
            entry = sheet_root.find(f'.//s:c[@r="{col}{number}"]', ns)
            assert entry is not None and len(entry) == 0, "Count fields must be blank"
print(f"Generated and validated Word + Excel: {len(CATALOG)} variants, counts and weights blank.")
