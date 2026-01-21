Import-Module PSSailpoint

$env:SAIL_BASE_URL="https://stonybrook-sb.api.identitynow.com"
$env:SAIL_CLIENT_ID="204e3b289e2b4cf8943536729bffc74f"
$env:SAIL_CLIENT_SECRET="290873a957980471463d34d28e79bd62c1eefaac26a222f7f94c9751b043c5a8"

$FILE_PATH = "C:\Users\bradcar\OneDrive - CDW\Documents\Projects\Stony Brook\colab-saas-conn-sailpoint-identity-fusion\stage\exceptions.csv" 
$ACCESS_PROFILE_ID = "3e069d52fc084ff0a35bdde7fb6e8cc4"

$usernameExceptionReason = "Non-unique username"
$script:uniqueUsernames = [System.Collections.ArrayList] @()
$exceptions = Import-Csv $FILE_PATH
$exceptions | ForEach-Object {
    if ($_.Reason -ne $usernameExceptionReason) { continue }
    Write-Host "Processing $($_.Username) - $($_.Identity)"

    if (-not $script:uniqueUsernames.Contains($_.Username)) {
        [void] $script:uniqueUsernames.Add($_.Username)
    } else {
        Write-Host "Requesting a new ID for $($_.Identity)"

        $req = Get-BetaIdentities -Filters "alias eq `"$($_.Identity)`""

        #$accessRequestedFor = Initialize-AccessItemRequestedFor -Type "IDENTITY" -Id $_.Identity
        $accessRequest = Initialize-AccessRequest -RequestedFor $req.id -RequestType "GRANT_ACCESS" -RequestedItems @{
            type = "ACCESS_PROFILE"
            comment = "Duplicate ID"
            id = $ACCESS_PROFILE_ID
        }
        $req = New-AccessRequest -AccessRequest $accessRequest

        Start-Sleep -Seconds 60
        break
    }
}  