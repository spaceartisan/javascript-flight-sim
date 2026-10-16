<CsoundSynthesizer>
<CsOptions>
; Render with: csound -d -W -o assets-preview.wav tools/aeronaut-soundbank.csd
-d -W -o assets-preview.wav
</CsOptions>
<CsInstruments>
sr = 44100
ksmps = 32
nchnls = 2
0dbfs = 1

; Turbine spool, blended low harmonics, heated filtered air.
instr 1
 iAmp = p4
 kEnv linseg 0, .12, iAmp, p3-.35, iAmp, .23, 0
 kHz expseg 46, p3, 118
 aCore vco2 kEnv*.40, kHz
 aWhine oscili kEnv*.18, kHz*3.5
 aAir rand kEnv*.2
 aAir tone aAir, 1050
 aMix = aCore+aWhine+aAir
 outs aMix, aMix
endin

; Missile motor: rising pressure transient, falling ignition sweep.
instr 2
 iAmp = p4
 kEnv expseg .001, .022, iAmp, p3-.022, .001
 kHz expseg 2100, p3, 270
 aMotor vco2 kEnv*.40, kHz
 aHiss rand kEnv*.33
 aHiss tone aHiss, 3200
 aMix = aMotor+aHiss
 outs aMix, aMix
endin

; Cockpit lock/chirp with double phase tone.
instr 3
 iAmp = p4
 kEnv linseg 0, .012, iAmp, p3-.07, iAmp, .058, 0
 a1 oscili kEnv*.7, 990
 a2 oscili kEnv*.3, 1485
 outs a1+a2, a1+a2
endin

; Detonation: rapid transient, compressed descending roar.
instr 4
 iAmp = p4
 kEnv expseg iAmp, p3, .001
 kHz expseg 125, p3, 29
 aSub vco2 kEnv*.46, kHz
 aNoise rand kEnv*.51
 aNoise tone aNoise, 380
 aMix = aSub+aNoise
 outs aMix, aMix
endin
</CsInstruments>
<CsScore>
i1 0 2.8 .35
i2 3 .62 .43
i3 3.9 .20 .22
i4 4.3 1.3 .50
e
</CsScore>
</CsoundSynthesizer>