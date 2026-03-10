$response = Invoke-RestMethod -Uri "https://api.github.com/search/code?q=animated_login_character.riv" -UserAgent "Mozilla/5.0"
if ($response.items.Count -gt 0) {
    $fileUrl = $response.items[0].url
    $fileInfo = Invoke-RestMethod -Uri $fileUrl -UserAgent "Mozilla/5.0"
    $downloadUrl = $fileInfo.download_url
    Invoke-WebRequest -Uri $downloadUrl -OutFile "C:\Coding\Software\frontend\assets\riv\animated_login_character.riv"
    Write-Host "Downloaded successfully from: $downloadUrl"
} else {
    Write-Host "File not found via GitHub API"
}
