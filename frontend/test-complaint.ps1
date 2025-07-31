param(
    [string]$documentId = "111de510-135d-457f-a7bb-383f95aea28a",
    [string]$agency = "Прокуратура"
)

$headers = @{
    "Content-Type" = "application/json"
}

$body = @{
    agency = $agency
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest `
        -Uri "http://localhost:3001/api/documents/$documentId/complaints" `
        -Method POST `
        -Headers $headers `
        -Body $body `
        -UseBasicParsing
    
    $response.Content | ConvertFrom-Json | Format-List
}
catch {
    Write-Host "Ошибка: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $responseBody = $reader.ReadToEnd()
        Write-Host "Детали ошибки: $responseBody"
    }
}