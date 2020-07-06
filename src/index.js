import 'bootstrap/dist/css/bootstrap.css'
import $ from 'jquery/dist/jquery.min'
import './game.scss';

/*
   Task 1. Создание переменных.
   Связка с DOM элементами получить элемент по ID можно так:
   document.getElementById('map')
   или так
   $('#map')[0]
*/

//
const $map = document.getElementById('map');
const $log = document.getElementById('log');
const $progressBar = document.getElementById('progressBar');
const $teamFirst__name = document.getElementById('teamFirst__name');
const $teamFirst__score = document.getElementById('teamFirst__score');
const $teamFirst__lives = document.getElementById('teamFirst__lives');
const $btnStart = document.getElementById('btnStart');
const $btnStop = document.getElementById('btnStop');
const $btnConnect = document.getElementById('btnConnect');
const $btnDisconnect = document.getElementById('btnDisconnect');
const $btnReconnect = document.getElementById('btnReconnect');
const $btnCancel = document.getElementById('btnCancel');
const $btnExit = document.getElementById('btnExit');

function randomInt(min = 0, max) {
    return min + Math.floor((max - min) * Math.random());
}

function setProgress(progress = 0) {
    console.log('$progressBar:', $progressBar)
    $progressBar.style.width = `${progress}%`;
}

setProgress(randomInt(10, 90));