import { RawShaderMaterial, Clock, Vector4, Vector3, Vector2, TextureLoader } from 'three';

import vert from './shaders/shader.vert';
import frag from './shaders/shader.frag';

import commentRegex from 'comment-regex';

const transparentize = `vec2 transparentizeUv = fragCoord.xy / iResolution.xy;\nfloat textureAlpha = texture( iChannel0, transparentizeUv ).a;\nfloat sumA = fragColor.r + fragColor.g + fragColor.b;\nfragColor = vec4(fragColor.xyz, sumA + textureAlpha);\n}`;

export default class ShaderToyMaterial extends RawShaderMaterial {

    constructor(shaderToySample, options_) {
        var options = options_ || {};
        options.aspectRatio = options.aspectRatio || 1500 / 750;
        let width = 1500;
        let height = width / options.aspectRatio;
        options.width = width;
        options.height = height;

        let usedUniforms = ShaderToyMaterial.retriveUsedUniforms(shaderToySample);

        var clock = new Clock();
        super({
            vertexShader: vert,
            fragmentShader: "",
        });
        if (usedUniforms.iTime || usedUniforms.iTimeDelta || usedUniforms.iFrame || usedUniforms.iDate) {
            if (usedUniforms.iTime || usedUniforms.iTimeDelta)
                this.clock = clock;
            this.registerUpdate();
        }

        let data = this.createUniformsObject(usedUniforms, options);

        this.uniforms = data.prof;
        var finalfrag = frag + "\n" + data.code + "\n" + shaderToySample;

        if (options.transparentize) {
            const n = finalfrag.lastIndexOf('}');
            finalfrag = finalfrag.substring(0, n) + "\n" + transparentize;
        }

        this.fragmentShader = finalfrag;
    }

    registerUpdate() {
        setTimeout(() => this.update(), 0);
    }

    update() {
        if (this.uniforms.iTime) {
            this.uniforms.iTime.value = this.clock.getElapsedTime();
        }
        if (this.uniforms.iTimeDelta) {
            this.uniforms.iTimeDelta.value = this.clock.getDelta();
        }
        if (this.uniforms.iFrame) {
            this.uniforms.iFrame.value = this.uniforms.iFrame.value + 1;
        }


        if (this.uniforms.iDate) {
            let dt = new Date;
            let sec = dt.getSeconds() + (60 * dt.getMinutes()) + (60 * 60 * dt.getHours());
            this.uniforms.iDate.value = new Vector4(
                dt.getFullYear(), dt.getMonth(), dt.getDay(), sec
            );
        }

        if (this.uniforms.iChannelResolution) {

            let checkchannel = (i) => {

                if (this.uniforms["iChannel" + i] && this.uniforms["iChannel" + i].value.image) {
                    this.uniforms.iChannelResolution.value[i] = new Vector3(
                        this.uniforms["iChannel" + i].value.image.width,
                        this.uniforms["iChannel" + i].value.image.height);
                }
            }

            for (let index = 0; index < 4; index++) {
                checkchannel(index);
            }
        }
        requestAnimationFrame(() => {
            this.update()
        });
    }

    //Returns uniforms need
    static retriveUsedUniforms(shaderToySample) {
        /*
        uniform vec3 iResolution; //Done: viewport resolution (in pixels)
        uniform float iTime; //Done: shader playback time (in seconds)
        uniform float iTimeDelta; //Done: render time (in seconds)
        uniform int iFrame; //Done: shader playback frame

        uniform float iChannelTime[4]; //Wont Do now: channel playback time (in seconds)
        uniform vec3 iChannelResolution[4]; // channel resolution (in pixels)
        uniform vec4 iMouse; // mouse pixel coords. xy: current (if MLB down), zw: click
        uniform samplerXX iChannel0..3; // input channel. XX = 2D/Cube
        uniform vec4 iDate; //Do (year, month, day, time in seconds)
        uniform float iSampleRate; //Wont Do sound sample rate (i.e., 44100)

        */
        let commentLessShader = shaderToySample.replace(commentRegex(), "");
        let expectedUniforms = "iTime,iTimeDelta,iResolution,iFrame,iChannelTime[4],iChannelResolution,iChannel0,iChannel1,iChannel2,iChannel3,iDate,iMouse".split(",");
        let existingUniforms = {};
        expectedUniforms.forEach(uniform => {
            if (commentLessShader.includes(uniform))
                existingUniforms[uniform] = true;
        });

        return existingUniforms;
    }


    createUniformsObject(usedUniforms, options) {
        let uniforms = {};
        let uniformsCode = "";

        if (usedUniforms.iResolution) {
            uniforms.iResolution = { value: new Vector2(options.width, options.height) }
        }

        if (usedUniforms.iTime) {
            uniforms.iTime = { type: "1f", value: this.clock.getElapsedTime() };
            uniformsCode += "uniform float iTime;\n";
        }
        if (usedUniforms.iDate) {
            uniforms.iDate = { value: new Vector4() };
            uniformsCode += "uniform vec4 iDate;\n";
        }

        //uniform vec4 iDate;


        if (usedUniforms.iTimeDelta) {
            uniforms.iTimeDelta = { type: "1f", value: this.clock.getDelta() }
            uniformsCode += "uniform float iTimeDelta;\n";
        }


        if (usedUniforms.iFrame) {
            uniforms.iFrame = { type: "1i", value: 0 }
            uniformsCode += "uniform int iFrame;\n";
        }

        if (usedUniforms.iMouse) {
            uniforms.iMouse = {
                value: new Vector4(
                    options.width / 2,
                    options.height / 2,
                    options.width / 2,
                    options.height / 2
                )
            };
            uniformsCode += "uniform vec4 iMouse;\n";
        }

        let this_ = this;

        if (usedUniforms["iChannelResolution"]) {
            uniforms["iChannelResolution"] = { type: "v3v", value: [
                    new Vector3(),
                    new Vector3(),
                    new Vector3(),
                    new Vector3()
                ] };
            uniformsCode += "uniform vec3 iChannelResolution[4];\n";
        }

        function checkchannel(i) {
            if (usedUniforms["iChannel" + i]) {

                let texture = options.map ? options.map : this_.getDefaultTexture();
                texture = (Array.isArray(texture)) ? texture[i] : texture;
                uniforms["iChannel" + i] = { type: "t", value: texture }
                uniformsCode += "uniform sampler2D " + ["iChannel" + i] + ";\n";
            }
        }

        for (let index = 0; index < 4; index++) {
            checkchannel(index);
        }

        return { prof: uniforms, code: uniformsCode };
    }

    getDefaultTexture() {
        if (!ShaderToyMaterial.defaultTexture)
            ShaderToyMaterial.defaultTexture = new TextureLoader().load("https://threejs.org/examples/textures/UV_Grid_Sm.jpg", () => {
                this.update();
            });
        return ShaderToyMaterial.defaultTexture;
    }
}
