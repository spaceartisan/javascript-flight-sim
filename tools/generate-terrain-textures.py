#!/usr/bin/env python3
"""Generate authored, seamlessly tiling dry-ground textures for AERONAUT.

This standalone deterministic art pipeline produces three surface families:
  dirt: compacted dusty gravel/sand, pebble streaking, lighter silty deposits
  scrub: olive grass tufts on dry earth, sparse pebbles and dry plant matter
  rock: grey/tan weathered slate, stratified fractures and chips

Outputs three sRGB WebP color textures and three RGBA WebP height-normal/roughness
textures (RGB tangent-ish relief normal, A perceptual roughness). All maps
are tileable and intended for three-way slope/elevation blending on the GPU.

Dependencies: numpy, scipy, Pillow. Run: python tools/generate-terrain-textures.py
No downloaded art/photography or generative AI images are used.
"""
from pathlib import Path
import numpy as np
from scipy.ndimage import gaussian_filter, sobel
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets'/'terrain';OUT.mkdir(parents=True,exist_ok=True)
N=512
rng=np.random.default_rng(27613)

def smooth_noise(scale):
    # Toroidal (wrap) bicubic-like multiscale noise; no tiling seam at boundaries.
    grid=rng.random((N,N),dtype=np.float32)
    return gaussian_filter(grid,sigma=scale,mode='wrap')

def norm(a):
    return (a-np.min(a))/max(1.e-7, np.max(a)-np.min(a))

def fractal():
    v=0
    for radius,amount in [(120,.22),(48,.32),(19,.24),(6,.14),(1.4,.08)]:
        v+=norm(smooth_noise(radius))*amount
    return v

def colorize(base,h,color_variation=36):
    x=np.clip(h-.5,-.48,.48)*color_variation
    cc=np.stack([base[k]+x*(1+.13*k) for k in range(3)],axis=-1)
    return np.clip(cc,0,255)

def scatter(rgb,seed,kind):
    # Raster brush marks are explicitly drawn onto surface albedo, not shader noise.
    pr=np.random.default_rng(seed)
    im=Image.fromarray(rgb.astype(np.uint8),'RGB');draw=ImageDraw.Draw(im,'RGB')
    if kind=='dirt':
        for j in range(3200):
            x=int(pr.integers(0,N));y=int(pr.integers(0,N));r=float(pr.choice([.5,.8,1.3,2.0,2.5],p=[.29,.34,.22,.12,.03]));
            c=tuple(int(n) for n in pr.choice([[50,46,38],[124,106,77],[172,157,117],[184,170,139],[83,78,60]]))
            draw.ellipse((x-r,y-r*.7,x+r,y+r*.7),fill=c)
        # Drifted, dusty gravel strata with sparse hardpack scuffs.
        for j in range(45):
            x=int(pr.integers(0,N));y=int(pr.integers(0,N));l=int(pr.integers(9,48));
            draw.line((x,y,x+l,y-int(l*.06)),fill=(149,130,103),width=1)
    elif kind=='scrub':
        for j in range(1100):
            x=int(pr.integers(0,N));y=int(pr.integers(0,N));
            # golden/olive scrub grass clumps, painted with thin angled strokes
            grass=pr.choice([0,1,2,3],p=[.38,.28,.26,.08]);
            colors=[(91,101,59),(125,121,69),(172,149,82),(62,77,48)]
            col=colors[grass]
            for k in range(int(pr.integers(2,9))):
                dx=int(pr.integers(-5,6));dy=int(pr.integers(-4,4));span=int(pr.integers(2,9))
                xx=(x+dx)%N;yy=(y+dy)%N
                draw.line((xx,yy,xx+int(span*.4),yy-span),fill=col,width=1)
        for j in range(600):
            x=int(pr.integers(0,N));y=int(pr.integers(0,N));r=int(pr.integers(1,3))
            draw.ellipse((x-r,y-r,x+r,y+r),fill=(99,92,74))
    else:
        # fractured stone veins and bleached strata, with very soft fine cracks
        for j in range(150):
            x=int(pr.integers(0,N));y=int(pr.integers(0,N));
            dx=int(pr.integers(8,48));dy=int(pr.integers(-7,7));
            color=tuple(int(n) for n in pr.choice([[57,65,64],[91,100,91],[158,150,130],[190,177,150]]))
            
            for ox in (-N,0,N):
                for oy in (-N,0,N):draw.line((x+ox,y+oy,x+dx+ox,y+dy+oy),fill=color,width=1)
        for j in range(1800):
            x=int(pr.integers(0,N));y=int(pr.integers(0,N));
            c=tuple(int(n) for n in pr.choice([[66,68,65],[149,151,137],[171,156,130]]))
            draw.point((x,y),fill=c)
    return np.asarray(im).copy()

def build(kind):
    coarse=fractal()
    fine=norm(smooth_noise(2.0))
    fine2=norm(smooth_noise(.6))
    yy,xx=np.mgrid[:N,:N]
    if kind=='dirt':
        # Dry compacted soil: pale fine silt with darker granular seams.
        streak=np.sin(xx*.035+norm(smooth_noise(29))*7)*.045
        h=coarse*.68+fine*.24+fine2*.08+streak
        rgb=colorize([132,116,89],h,58)
        rough=np.clip(.85+.1*(.5-fine)+.035*(coarse-.5),.71,.97)
        detail=h*1.6+fine2*.11
    elif kind=='scrub':
        # Dry scrub: patchy brown earth and low-saturation ochre/olive terrain.
        organic=norm(smooth_noise(17))
        h=coarse*.47+fine*.27+organic*.24+fine2*.02
        base=colorize([108,107,80],h,54)
        grass=norm(smooth_noise(11))
        mask=np.clip((grass-.39)*2.3,0,1)[...,None]
        olive=np.asarray([107,118,76])+((fine-.5)*43)[...,None]
        rgb=np.clip(base*(1-mask*.72)+olive*mask*.72,0,255)
        rough=np.clip(.82+.12*(.5-organic)+.08*(grass-.4),.73,.99)
        detail=h*1.05+fine2*.12
    else:
        # Sedimentary bedrock: striations, lichen-tinged shadows and fractured slabs.
        bedding=np.sin(yy*.092+norm(smooth_noise(25))*13+xx*.014)*.095
        fractures=np.maximum(0,np.sin(yy*.19+norm(smooth_noise(5))*7))**8*.13
        h=coarse*.62+fine*.25+fine2*.13+bedding-fractures
        base=colorize([118,120,109],h,65)
        amber=norm(smooth_noise(33))*.28
        rgb=np.clip(base + amber[...,None]*np.array([19,10,-12]),0,255)
        rough=np.clip(.66+.23*(.5-fine)+.12*(.5-coarse),.47,.95)
        detail=h*2.2+fine2*.18
    rgb=scatter(rgb,{'dirt':180,'scrub':290,'rock':394}[kind],kind)
    # Avoid saturated colors and strong baked shadows: proper lighting comes from PBR.
    out_color=Image.fromarray(rgb.astype(np.uint8),'RGB')
    out_color.save(OUT/f'{kind}-albedo.webp',format='WEBP',quality=89,method=6)
    dhdx=(np.roll(detail,-1,axis=1)-np.roll(detail,1,axis=1))*2.3
    dhdy=(np.roll(detail,-1,axis=0)-np.roll(detail,1,axis=0))*2.3
    normal=np.stack([-dhdx,-dhdy,np.ones_like(detail)],axis=-1)
    normal/=np.maximum(1e-6,np.linalg.norm(normal,axis=-1,keepdims=True))
    nx=np.clip((normal*.5+.5)*255,0,255).astype(np.uint8)
    a=np.clip(rough*255,0,255).astype(np.uint8)
    nr=np.dstack([nx,a]);Image.fromarray(nr,'RGBA').save(OUT/f'{kind}-normal-roughness.webp',format='WEBP',quality=91,method=6)
    print(kind,'color', (OUT/f'{kind}-albedo.webp').stat().st_size,
          'normal+roughness',(OUT/f'{kind}-normal-roughness.webp').stat().st_size)
    return out_color

if __name__=='__main__':
    ims=[build(x) for x in ('dirt','scrub','rock')]
    out=Image.new('RGB',(N*3,N),(30,30,30))
    for i,im in enumerate(ims):out.paste(im,(i*N,0))
    out.save(ROOT/'docs'/'terrain-material-contact-sheet.jpg',quality=92)
