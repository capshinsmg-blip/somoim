[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$content = [Console]::In.ReadToEnd()
try {
    $json = $content | ConvertFrom-Json
    $fp = $json.tool_input.file_path
    $filename = [System.IO.Path]::GetFileName($fp)
    if ($filename -notmatch '\.(gs|json)$|^index\.html$') { exit 0 }
} catch { exit 0 }

# push만 수행 — GAS 버전 200개 한도 소진 방지 (배포는 요청 시 수동 실행)
# 수동 배포: clasp deploy --deploymentId <ID> --description "..."
Push-Location "C:\Users\Administrator\Desktop\소모임플렛폼\관리툴"
clasp push --force
Pop-Location