@echo off
set "PATH=D:\tools\npm-global;D:\Tools\Scoop\shims;D:\Tools\Scoop\apps\nodejs-lts\current;%PATH%"
cd /d "%~dp0.."
ng serve --port 4200
