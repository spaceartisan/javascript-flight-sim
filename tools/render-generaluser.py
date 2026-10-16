#!/usr/bin/env python3
"""Offline GeneralUser GS v2.0.3 acoustic soundbank for AERONAUT.
Usage: python tools/render-generaluser.py /path/to/GeneralUser-GS.sf2 [output-directory]
Requires libfluidsynth, numpy, scipy, soundfile. All included rendered assets
contain GeneralUser GS preset samples. Do not commit the full source SF2.
"""
import ctypes as C, pathlib, sys, numpy as np, soundfile as sf
from scipy import signal
FS=44100
OUT=pathlib.Path(sys.argv[2] if len(sys.argv)>2 else 'assets/audio')
SF2=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else None
if SF2 is None or not SF2.is_file():
 raise SystemExit('Usage: python tools/render-generaluser.py /path/GeneralUser-GS.sf2 [output-dir]')
OUT.mkdir(parents=True,exist_ok=True)
fluid=C.CDLL('libfluidsynth.so.3')
ptr=C.c_void_p

def bind(name,ret,args):
 func=getattr(fluid,name);func.restype=ret;func.argtypes=args;return func
settings=bind('new_fluid_settings',ptr,[])()
bind('fluid_settings_setnum',C.c_int,[ptr,C.c_char_p,C.c_double])(settings,b'synth.sample-rate',float(FS))
bind('fluid_settings_setnum',C.c_int,[ptr,C.c_char_p,C.c_double])(settings,b'synth.gain',.42)
setint=bind('fluid_settings_setint',C.c_int,[ptr,C.c_char_p,C.c_int])
setint(settings,b'synth.reverb.active',0);setint(settings,b'synth.chorus.active',0)
synth=bind('new_fluid_synth',ptr,[ptr])(settings)
load=bind('fluid_synth_sfload',C.c_int,[ptr,C.c_char_p,C.c_int]);fid=load(synth,str(SF2).encode('utf-8'),1)
if fid<0:raise RuntimeError('Could not load GeneralUser GS sf2')
program=bind('fluid_synth_program_select',C.c_int,[ptr,C.c_int,C.c_int,C.c_int,C.c_int])
on=bind('fluid_synth_noteon',C.c_int,[ptr,C.c_int,C.c_int,C.c_int]);off=bind('fluid_synth_noteoff',C.c_int,[ptr,C.c_int,C.c_int]);clear=bind('fluid_synth_all_sounds_off',C.c_int,[ptr,C.c_int]);
write=bind('fluid_synth_write_float',C.c_int,[ptr,C.c_int,ptr,C.c_int,C.c_int,ptr,C.c_int,C.c_int])

def read(seconds):
 n=round(seconds*FS)
 l=np.zeros(n,dtype=np.float32);r=np.zeros(n,dtype=np.float32)
 if write(synth,n,l.ctypes.data,0,1,r.ctypes.data,0,1):raise RuntimeError('FluidSynth render failed')
 return np.column_stack((l,r)).astype(np.float64)

def note(pitch,prog,duration,release=.3,velocity=110,bank=0):
 clear(synth,0)
 if program(synth,0,fid,bank,prog):raise RuntimeError(f'Invalid preset bank={bank} program={prog}')
 on(synth,0,pitch,velocity)
 a=read(duration)
 off(synth,0,pitch)
 b=read(release)
 return np.concatenate((a,b),axis=0)

def seq(items,duration,prog):
 # events: (start seconds, length seconds, midi note, velocity)
 y=np.zeros((round(FS*duration),2),dtype='float64')
 for t,length,pitch,velocity in items:
  a=note(pitch,prog,length,.9,velocity)
  s=round(t*FS);e=min(len(y),s+len(a));y[s:e]+=a[:e-s]
 return y

def fit(x,n):
 if len(x)>=n:return x[:n].copy()
 return np.pad(x,((0,n-len(x)),(0,0)))

def norm(x,rms=.09):
 current=float(np.sqrt(np.mean(x*x)))
 if current<1e-5:raise RuntimeError('GeneralUser patch rendered silence')
 return x*(rms/current)

def softclip(x):return np.tanh(x*1.45)/1.45

def highpass(x,freq=90):return signal.sosfilt(signal.butter(2,freq,fs=FS,output='sos',btype='highpass'),x,axis=0)

def lowpass(x,freq=4000):return signal.sosfilt(signal.butter(2,freq,fs=FS,output='sos',btype='lowpass'),x,axis=0)

def fade(x,head=.015,tail=.12):
 x=x.copy();a=max(1,int(head*FS));b=max(1,int(tail*FS))
 x[:a]*=np.linspace(0,1,a)[:,None];x[-b:]*=np.linspace(1,0,b)[:,None];return x

def loop(x,duration=5.3,crossfade=.65,start=.8):
 n=int(duration*FS);s=int(start*FS);c=int(crossfade*FS)
 data=fit(x[s:],n+c);out=data[:n].copy()
 # loop endpoint matches start point from original timeline: data[n] directly
 theta=np.linspace(0,np.pi/2,c)
 out[:c]=data[n:n+c]*(np.cos(theta)**2)[:,None]+data[:c]*(np.sin(theta)**2)[:,None]
 return out

def export(filename,x,looping=False):
 x=softclip(x)
 mx=np.max(np.abs(x))
 if mx>.88:x*=.88/mx
 peak=float(np.max(np.abs(x)));rms=float(np.sqrt(np.mean(x*x)))
 if peak<.004:raise RuntimeError(filename+' near-silent')
 sf.write(OUT/filename,x,FS,format='OGG',subtype='VORBIS')
 print(f'{filename:22s} duration={len(x)/FS:5.2f}s rms={rms:.3f} peak={peak:.3f} {(OUT/filename).stat().st_size/1024:.1f} KiB',flush=True)

# The sampled helicopter, pads, and synth voice create harmonically varied turbine texture.
length=7.2;n=round(FS*length)
engine=(.38*norm(note(44,125,length),.11)+.33*norm(note(36,90,length),.1)+.29*norm(note(44,89,length),.11))
engine=lowpass(highpass(engine,35),1900)
export('engine-core.ogg',loop(engine,5.4,.75,.75),True)

# GeneralUser pads and FX are cross-layered for an increasingly urgent reheat texture.
after=(.45*norm(note(45,95,length),.12)+.35*norm(note(40,99,length),.13)+.2*norm(note(37,125,length),.11))
after=highpass(after,75)
export('afterburner.ogg',loop(after,5.4,.75,.6),True)

# SF2 seashore + helicopter recordings; browser filters this with airspeed.
wind=.65*norm(note(53,122,length),.12)+.35*norm(note(58,125,length),.11)
wind=highpass(wind,300)
export('air-rush.ogg',loop(wind,5.4,.75,.6),True)

# Select: a short glassy click with a warm tail.
s=seq([(0,.11,85,95)],.7,9)+seq([(0,.16,76,78)],.7,98)*.26
export('contact-select.ogg',fade(norm(s,.07),.002,.2))

# Two-tone IR seeker lock. Bright and unmistakable, but not overly loud.
s=seq([(0,.11,86,115),(.15,.16,93,110)],.7,9)+.3*seq([(0,.4,74,83)],.7,94)
export('seeker-lock.ogg',fade(norm(s,.07),.002,.16))

# Gear/flap: low woodblock and taiko drum resonances, no distracting brass tone.
s=.65*seq([(0,.16,49,110),(.18,.13,52,99)],.85,115)+.35*seq([(0,.24,38,110)],.85,116)
export('gear-action.ogg',fade(norm(s,.085),.003,.25))

# Missile: gunshot impulse and layered SF2 synth drum + orchestra accents.
s=seq([(0,.18,64,124)],1.35,127)+.7*seq([(.07,.31,50,120)],1.35,118)+.45*seq([(.03,.22,47,106)],1.35,55)
export('missile-launch.ogg',fade(highpass(norm(s,.12),55),.001,.27))

# Target splash: timpani/GS gun shot and orchestral hit with broad release.
s=.85*seq([(0,.23,54,120)],2.0,127)+.6*seq([(0,.65,36,115)],2.0,47)+.5*seq([(.07,.50,43,121)],2.0,55)
export('impact.ogg',fade(lowpass(norm(s,.15),7600),.001,.5))

# Warning: synthetic gated beeps, pitched as subdued airplane annunciator.
s=seq([(0,.13,75,100),(.19,.13,75,100)],.62,80)+.15*seq([(0,.28,50,90)],.62,94)
export('caution.ogg',fade(norm(s,.065),.002,.06))

# Short return-to-base fanfare: layered Music Box + pads and orchestral strings.
notes=[(0,.26,67,99),(.19,.26,72,105),(.39,.29,76,100),(.61,.95,79,115)]
s=seq(notes,2.65,10)+.75*seq([(.58,1.6,60,81),(.58,1.6,64,80),(.58,1.6,67,83)],2.65,89)
export('mission-clear.ogg',fade(norm(s,.10),.003,.65))
print('\nPresets: GeneralUser GS v2.0.3; 0-based General MIDI program numbering.')
