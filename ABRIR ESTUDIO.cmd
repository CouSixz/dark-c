@echo off
setlocal
cd /d "%~dp0"
python -c "import requests" >nul 2>nul
if errorlevel 1 (
  python -m pip install "requests[socks]>=2.32,<3"
  if errorlevel 1 goto erro
)
if not exist "painel\motor\node_modules\@remotion\cli\remotion-cli.js" (
  pushd "painel\motor"
  call npm ci --no-audit --no-fund
  if errorlevel 1 goto erro
  popd
)
python painel\servidor.py
if errorlevel 1 goto erro
exit /b 0
:erro
echo Confira Python 3 e Node.js com npm no computador.
pause
exit /b 1
