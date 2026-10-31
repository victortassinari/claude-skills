# Abre o .docx no Microsoft Word, embute as fontes, salva o .docx final e o modelo .dotx,
# e imprime uma página de conferência em PDF pela impressora "Microsoft Print to PDF".
# Requer Windows com Word instalado e as fontes da marca instaladas no usuário (veja SKILL.md).
# Uso: pwsh -File word_embutir_fontes.ps1 -Docx C:\caminho\marca_papel-timbrado.docx
param([Parameter(Mandatory)] [string] $Docx)

$Docx = (Resolve-Path $Docx).Path
$base = [IO.Path]::Combine([IO.Path]::GetDirectoryName($Docx), [IO.Path]::GetFileNameWithoutExtension($Docx))
# o Word trava arquivos abertos; trabalha numa cópia em TEMP e copia de volta
$tmp = Join-Path $env:TEMP ("timbrado-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory $tmp | Out-Null
Copy-Item $Docx "$tmp\entrada.docx"

$w = New-Object -ComObject Word.Application; $w.Visible = $false; $w.DisplayAlerts = 0
try {
  $d = $w.Documents.Open("$tmp\entrada.docx")
  $d.EmbedTrueTypeFonts = $true; $d.SaveSubsetFonts = $false; $d.DoNotEmbedSystemFonts = $true
  $d.SaveAs2("$tmp\final.docx", 16)   # wdFormatXMLDocument
  $d.SaveAs2("$tmp\final.dotx", 14)   # wdFormatXMLTemplate
  $d.Close($false)
  # ExportAsFixedFormat costuma falhar via COM em algumas instalações; a impressora virtual é mais confiável
  $d = $w.Documents.Open("$tmp\final.docx", $false, $true)
  $antes = $w.ActivePrinter
  $w.ActivePrinter = 'Microsoft Print to PDF'
  $d.PrintOut($false, $false, 0, "$tmp\conferencia.pdf", '', '', 0, 1, '', 0, $true)
  Start-Sleep -Seconds 4
  $w.ActivePrinter = $antes
  $d.Close($false)
} finally { $w.Quit() }

Copy-Item "$tmp\final.docx" "$base.docx" -Force
Copy-Item "$tmp\final.dotx" "$base.dotx" -Force
if (Test-Path "$tmp\conferencia.pdf") { Copy-Item "$tmp\conferencia.pdf" "$base-conferencia.pdf" -Force; "conferência: $base-conferencia.pdf (abra e OLHE a página)" }
"gravados: $base.docx e $base.dotx"
