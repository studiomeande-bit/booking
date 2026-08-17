<#
.SYNOPSIS
  납품 원본 폴더를 윈도우에서 그냥 열리는 여러 개의 zip 으로 나눈다.

.WHY
  이윤경(260810) 건에서 원본 약 1,800장 / 7GB대가 고객 Drive 폴더에 그대로 올라갔다.
  Drive 웹 다운로드는 이 규모에서 압축을 만들다 실패하고, 고객 화면은 스크롤이 끝없이 내려간다.

.WHY NOT 분할 압축(.zip.001 / .7z.001)
  진짜 분할 볼륨은 윈도우 탐색기가 못 연다 — 받는 쪽에 7-Zip 이 깔려 있어야 한다.
  그래서 볼륨 분할 대신 **각각 독립적으로 열리는 zip 여러 개**로 나눈다.
  받는 사람은 아무것도 설치할 필요 없이 파일 하나씩 더블클릭하면 된다.
  (윈도우 10 이상 탐색기는 ZIP64 를 읽으므로 조각당 2GB 를 넘겨도 되지만,
   Drive 업/다운로드 실패율 때문에 기본값을 1.5GB 로 잡았다.)

.EXAMPLE
  .\split-delivery-zips.ps1 -Source "D:\작업\260810_이윤경" -Destination "D:\작업\260810_이윤경_압축본"
  .\split-delivery-zips.ps1 -Source "D:\작업\260810_이윤경" -Destination "D:\out" -ChunkSizeMB 1000
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Destination,
  [int]$ChunkSizeMB = 1500,
  [string]$Prefix = ''
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Source)) { throw "원본 폴더를 찾을 수 없습니다: $Source" }
if ($ChunkSizeMB -lt 50) { throw "ChunkSizeMB 는 50 이상이어야 합니다." }
if (-not $Prefix) { $Prefix = Split-Path -Leaf $Source }

New-Item -ItemType Directory -Force -Path $Destination | Out-Null

# 사진만, 하위 폴더 포함 — 셀렉페이지 갤러리는 재귀로 세므로 최상위만 담으면
# "전체 원본"이라며 하위 폴더 사진이 조용히 빠진다. 상대 경로를 zip 에 보존한다.
$exts = @('.jpg', '.jpeg', '.png', '.heic', '.heif', '.tif', '.tiff', '.webp')
$srcRoot = (Resolve-Path -LiteralPath $Source).Path.TrimEnd('\') + '\'
$files = Get-ChildItem -LiteralPath $Source -File -Recurse |
  Where-Object { $exts -contains $_.Extension.ToLowerInvariant() } |
  ForEach-Object { $_ | Add-Member -NotePropertyName RelPath -NotePropertyValue ($_.FullName.Substring($srcRoot.Length) -replace '\\', '/') -PassThru } |
  Sort-Object RelPath

if ($files.Count -eq 0) { throw "원본 폴더에 사진 파일이 없습니다: $Source" }

$limit = [int64]$ChunkSizeMB * 1MB
$total = ($files | Measure-Object -Property Length -Sum).Sum
Write-Host ("원본 {0:N0}장 · {1:N1}GB · 조각당 최대 {2}MB" -f $files.Count, ($total / 1GB), $ChunkSizeMB)

# 1차: 조각 경계만 계산한다. 파일 하나가 조각 한도보다 크면 그 파일만 단독 조각이 된다.
$chunks = @()
$current = @()
$currentSize = [int64]0
foreach ($f in $files) {
  if ($current.Count -gt 0 -and ($currentSize + $f.Length) -gt $limit) {
    $chunks += , $current
    $current = @()
    $currentSize = [int64]0
  }
  $current += $f
  $currentSize += $f.Length
}
if ($current.Count -gt 0) { $chunks += , $current }

$pad = ([string]$chunks.Count).Length
$manifest = @()

for ($i = 0; $i -lt $chunks.Count; $i++) {
  $part = $i + 1
  $name = '{0}_{1}of{2}.zip' -f $Prefix, $part.ToString().PadLeft($pad, '0'), $chunks.Count
  $zipPath = Join-Path $Destination $name
  if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }

  $chunkFiles = $chunks[$i]
  $chunkBytes = ($chunkFiles | Measure-Object -Property Length -Sum).Sum
  Write-Host ("[{0}/{1}] {2} — {3:N0}장 / {4:N2}GB 압축 중..." -f $part, $chunks.Count, $name, $chunkFiles.Count, ($chunkBytes / 1GB))

  # Compress-Archive 는 큰 입력에서 느리고 2GB 부근에서 불안정하다. .NET ZipArchive 로 직접 쓴다.
  # CompressionLevel.NoCompression: JPEG 는 이미 압축돼 있어 다시 줄여봐야 몇 % 도 안 줄고 시간만 몇 배로 든다.
  Add-Type -AssemblyName System.IO.Compression | Out-Null
  Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null
  $stream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::CreateNew)
  try {
    $zip = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
      foreach ($f in $chunkFiles) {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
          $zip, $f.FullName, $f.RelPath, [System.IO.Compression.CompressionLevel]::NoCompression) | Out-Null
      }
    } finally { $zip.Dispose() }
  } finally { $stream.Dispose() }

  $manifest += [pscustomobject]@{
    part  = $name
    count = $chunkFiles.Count
    first = $chunkFiles[0].RelPath
    last  = $chunkFiles[-1].RelPath
    sizeMB = [math]::Round((Get-Item -LiteralPath $zipPath).Length / 1MB, 1)
  }
}

# 어느 조각에 몇 번 사진이 들어 있는지 — 고객이 특정 컷을 찾을 때 전부 받지 않아도 되게.
$manifestPath = Join-Path $Destination '목록.txt'
$lines = @("$Prefix — 분할 압축 목록", "생성: $(Get-Date -Format 'yyyy-MM-dd HH:mm')",
           "원본 $($files.Count)장 · 조각 $($chunks.Count)개", '')
foreach ($m in $manifest) {
  $lines += ('{0}  |  {1,5}장  |  {2,8:N1}MB  |  {3} ~ {4}' -f $m.part, $m.count, $m.sizeMB, $m.first, $m.last)
}
$lines | Set-Content -LiteralPath $manifestPath -Encoding UTF8

Write-Host ''
Write-Host ("완료 — {0} 에 zip {1}개 + 목록.txt" -f $Destination, $chunks.Count)
Write-Host '이 폴더의 파일들을 Drive 압축본 폴더에 업로드하면 됩니다.'
