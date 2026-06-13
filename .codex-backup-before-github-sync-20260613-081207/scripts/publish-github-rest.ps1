param(
  [string]$Repository = "gaylerylliam-art/buildmycv",
  [string]$Branch = "main",
  [string]$EnvPath = ".env"
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path ".").Path

function Get-TokenFromEnvFile {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Token file not found: $Path"
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }

    if ($trimmed -match "^\s*([^=]+?)\s*=\s*(.+?)\s*$") {
      return $matches[2].Trim().Trim('"').Trim("'")
    }

    return $trimmed.Trim('"').Trim("'")
  }

  throw "No token value found in $Path"
}

function Invoke-GitHubApi {
  param(
    [string]$Method,
    [string]$Path,
    [object]$Body = $null
  )

  $uri = "https://api.github.com/repos/$Repository$Path"
  $headers = @{
    Authorization = "Bearer $Token"
    Accept = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
    "User-Agent" = "codex-buildmycv-publisher"
  }

  if ($null -eq $Body) {
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
  }

  $json = $Body | ConvertTo-Json -Depth 100 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -ContentType "application/json; charset=utf-8" -Body $bytes
}

function Get-RelativeRepoPath {
  param([string]$FullName)
  $rootUri = [Uri]($Root.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar)
  $fileUri = [Uri]$FullName
  return $rootUri.MakeRelativeUri($fileUri).ToString()
}

function Should-SkipFile {
  param([IO.FileInfo]$File)
  $relative = Get-RelativeRepoPath $File.FullName
  $parts = $relative -split "/"

  if ($parts -contains ".git" -or $parts -contains ".netlify" -or $parts -contains "node_modules" -or $parts -contains "dist") {
    return $true
  }

  if ($relative -like ".env*" -or $relative -like "qa-*.png" -or $relative -eq "scripts/publish-github-rest.ps1") {
    return $true
  }

  return $false
}

$Token = Get-TokenFromEnvFile -Path $EnvPath
if (-not $Token) {
  throw "GitHub token is empty."
}

$repo = Invoke-GitHubApi -Method Get -Path ""
if ($repo.permissions.push -ne $true -and $repo.permissions.admin -ne $true) {
  throw "The token can read the repo but does not have push permission."
}

$parentSha = $null
try {
  $ref = Invoke-GitHubApi -Method Get -Path "/git/ref/heads/$Branch"
  $parentSha = $ref.object.sha
} catch {
  $status = $_.Exception.Response.StatusCode.value__
  if ($status -ne 404 -and $status -ne 409) {
    throw
  }
}

if (-not $parentSha) {
  $seedContent = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("# buildmycv`n"))
  $seedBody = @{
    message = "Seed repository"
    content = $seedContent
    branch = $Branch
  }
  Invoke-GitHubApi -Method Put -Path "/contents/README.md" -Body $seedBody | Out-Null
  $ref = Invoke-GitHubApi -Method Get -Path "/git/ref/heads/$Branch"
  $parentSha = $ref.object.sha
}

$treeEntries = New-Object System.Collections.Generic.List[object]
$files = Get-ChildItem -LiteralPath $Root -Recurse -File -Force | Where-Object { -not (Should-SkipFile $_) }

foreach ($file in $files) {
  $relative = Get-RelativeRepoPath $file.FullName
  $content = [IO.File]::ReadAllText($file.FullName, [Text.Encoding]::UTF8)
  $blob = Invoke-GitHubApi -Method Post -Path "/git/blobs" -Body @{
    content = $content
    encoding = "utf-8"
  }

  $treeEntries.Add(@{
    path = $relative
    mode = "100644"
    type = "blob"
    sha = $blob.sha
  })
}

$tree = Invoke-GitHubApi -Method Post -Path "/git/trees" -Body @{
  tree = $treeEntries
}

$commit = Invoke-GitHubApi -Method Post -Path "/git/commits" -Body @{
  message = "Publish CV builder frontend"
  tree = $tree.sha
  parents = @($parentSha)
}

Invoke-GitHubApi -Method Patch -Path "/git/refs/heads/$Branch" -Body @{
  sha = $commit.sha
  force = $true
} | Out-Null

"REPOSITORY=$Repository"
"BRANCH=$Branch"
"COMMIT=$($commit.sha)"
"FILES_UPLOADED=$($files.Count)"
"URL=https://github.com/$Repository/tree/$Branch"
