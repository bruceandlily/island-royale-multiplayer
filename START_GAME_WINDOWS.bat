@echo off
title Island Royale Multiplayer V34

echo ==========================================
echo  Island Royale Multiplayer V34 Launcher
echo ==========================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo Node.js is not installed.
  echo.
  echo Install Node.js first from:
  echo https://nodejs.org
  echo.
  echo After installing Node.js, close this window and double-click this file again.
  echo.
  pause
  exit /b
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
  echo npm is not installed correctly.
  echo Reinstall Node.js from https://nodejs.org
  echo.
  pause
  exit /b
)

if not exist node_modules (
  echo First time setup: installing multiplayer server files...
  echo This can take a minute.
  echo.
  npm install
  if %errorlevel% neq 0 (
    echo.
    echo npm install failed.
    echo Make sure you are connected to the internet.
    echo.
    pause
    exit /b
  )
)

echo.
echo Starting server...
echo Your game will open at http://localhost:3000
echo.
start http://localhost:3000
npm start

echo.
echo Server stopped.
pause
