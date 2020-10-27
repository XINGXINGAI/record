(function (window) {
    //兼容
    window.URL = window.URL || window.webkitURL;
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
    var sdcard = navigator.getDeviceStorage('sdcard');
    var soundClips = document.querySelector('.sound-clips');

    //电量监控
    navigator.getBattery().then((battery)=> {
        var remainBatteryValue;
        remainBatteryValue = parseInt(battery.level * 100);
        battery.addEventListener("levelchange", ()=>{
            remainBatteryValue = parseInt(battery.level * 100);
            console.log(remainBatteryValue);
            if (remainBatteryValue == 5) {
                alert("电量不足");
            } else if (remainBatteryValue == 1) {
                alert("电量不足,应用即将关闭");
            }
        });
        if (remainBatteryValue == 5) {
            alert("电量不足");
        } else if (remainBatteryValue == 1) {
            alert("电量不足,应用即将关闭");
        }
    });
    
    //产生随机文件名称
    function createFile(){
        var now=new Date(); 
        var year = now.getFullYear(); //得到年份
        var month = now.getMonth();//得到月份
        var date = now.getDate();//得到日期
        var hour = now.getHours();//得到小时
        var minu = now.getMinutes();//得到分钟
        month = month + 1;
        if (month < 10) month = "0" + month;
        if (date < 10) date = "0" + date;
    
        var number = now.getSeconds()%43; //这将产生一个基于目前时间的0到42的整数。
        var time = year + month + date+hour+minu;
        console.log(year  + "  " + month + "  " + date + "  " + hour + "  " + minu + "  " + time + " " +number);
        return time+"_"+number;
    };

    // blob 转为ArrayBuffer
    function fileToArrayBuffer (blob) {
        return new Promise(resolve => {
            var reader = new FileReader();
            reader.onload = function () {
                resolve(reader.result);
            }
            reader.readAsArrayBuffer(blob);
        });
    };

    // Convert AudioBuffer to a Blob using WAVE representation
    function bufferToWave(abuffer, len) {
        var numOfChan = abuffer.numberOfChannels,
        length = len * numOfChan * 2 + 44,
        buffer = new ArrayBuffer(length),
        view = new DataView(buffer),
        channels = [], i, sample,
        offset = 0,
        pos = 0;

        // write WAVE header
        // "RIFF"
        setUint32(0x46464952);
        // file length - 8
        setUint32(length - 8);
        // "WAVE"
        setUint32(0x45564157);
        // "fmt " chunk
        setUint32(0x20746d66);
        // length = 16
        setUint32(16);
        // PCM (uncompressed)
        setUint16(1);
        setUint16(numOfChan);
        setUint32(abuffer.sampleRate);
        // avg. bytes/sec
        setUint32(abuffer.sampleRate * 2 * numOfChan);
        // block-align
        setUint16(numOfChan * 2);
        // 16-bit (hardcoded in this demo)
        setUint16(16);
        // "data" - chunk
        setUint32(0x61746164);
        // chunk length
        setUint32(length - pos - 4);   

        // write interleaved data
        for(i = 0; i < abuffer.numberOfChannels; i++)
        channels.push(abuffer.getChannelData(i));

        while(pos < length) {
            // interleave channels
            for(i = 0; i < numOfChan; i++) {
            // clamp
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            // scale to 16-bit signed int
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0;
            // write 16-bit sample
            view.setInt16(pos, sample, true);
            pos += 2;
            }
            // next source sample
            offset++;
        }

        // create Blob
        return new Blob([buffer], {type: "audio/wav"});

        function setUint16(data) {
            view.setUint16(pos, data, true);
            pos += 2;
        }
    
        function setUint32(data) {
            view.setUint32(pos, data, true);
            pos += 4;
        }
    };

    var HZRecorder = function (stream, config) {
        config = config || {};
        config.sampleBits = config.sampleBits || 8;      //采样数位 8, 16
        config.sampleRate = config.sampleRate || (44100 / 6);   //采样率(1/6 44100)
 
        var context = new (window.webkitAudioContext || window.AudioContext)();
        var audioInput = context.createMediaStreamSource(stream);
        var createScript = context.createScriptProcessor || context.createJavaScriptNode;
        var recorder = createScript.apply(context, [4096, 1, 1]);
 
        var audioData = {
            size: 0 ,        //录音文件长度
            buffer: [] ,      //录音缓存
            time: 0,  //音频时长
            inputSampleRate: context.sampleRate,    //输入采样率
            inputSampleBits: 16,       //输入采样数位 8, 16
            outputSampleRate: config.sampleRate,    //输出采样率
            oututSampleBits: config.sampleBits,     //输出采样数位 8, 16
            input: function (data) {
                this.buffer.push(new Float32Array(data));
                this.size += data.length;
            },
            compress: function () { //合并压缩
                console.log(audioData);
                //合并
                console.log(this.size);
                console.log(this.buffer);
                var data = new Float32Array(this.size);
                var offset = 0;
                for (var i = 0; i < this.buffer.length; i++) {
                    data.set(this.buffer[i], offset);
                    offset += this.buffer[i].length;
                }
                //压缩
                var compression = parseInt(this.inputSampleRate / this.outputSampleRate);
                console.log( data.length);
                console.log(compression);
                var length = parseInt(data.length / compression);
                console.log(length);
                var result = new Float32Array(length);
                var index = 0, j = 0;
                while (index < length) {
                    result[index] = data[j];
                    j += compression;
                    index++;
                }
                return result;
            },
            encodeWAV: function () {
                var sampleRate = Math.min(this.inputSampleRate, this.outputSampleRate);
                var sampleBits = Math.min(this.inputSampleBits, this.oututSampleBits);
                var bytes = this.compress();
    
                var dataLength = bytes.length * (sampleBits / 8);
                var buffer = new ArrayBuffer(44 + dataLength);
                var data = new DataView(buffer);
                console.log(bytes);
                console.log(dataLength);
 
                var channelCount = 1;//单声道
                var offset = 0;
 
                var writeString = function (str) {
                    for (var i = 0; i < str.length; i++) {
                        data.setUint8(offset + i, str.charCodeAt(i));
                    }
                }
 
                // 资源交换文件标识符 
                writeString('RIFF'); offset += 4;
                // 下个地址开始到文件尾总字节数,即文件大小-8 
                data.setUint32(offset, 36 + dataLength, true); offset += 4;
                // WAV文件标志
                writeString('WAVE'); offset += 4;
                // 波形格式标志 
                writeString('fmt '); offset += 4;
                // 过滤字节,一般为 0x10 = 16 
                data.setUint32(offset, 16, true); offset += 4;
                // 格式类别 (PCM形式采样数据) 
                data.setUint16(offset, 1, true); offset += 2;
                // 通道数 
                data.setUint16(offset, channelCount, true); offset += 2;
                // 采样率,每秒样本数,表示每个通道的播放速度 
                data.setUint32(offset, sampleRate, true); offset += 4;
                // 波形数据传输率 (每秒平均字节数) 单声道×每秒数据位数×每样本数据位/8 
                data.setUint32(offset, channelCount * sampleRate * (sampleBits / 8), true); offset += 4;
                // 快数据调整数 采样一次占用字节数 单声道×每样本的数据位数/8 
                data.setUint16(offset, channelCount * (sampleBits / 8), true); offset += 2;
                // 每样本数据位数 
                data.setUint16(offset, sampleBits, true); offset += 2;
                // 数据标识符 
                writeString('data'); offset += 4;
                // 采样数据总数,即数据总大小-44 
                data.setUint32(offset, dataLength, true); offset += 4;

                this.time = dataLength / sampleRate;  // 数据/速度 = 时间


                // 写入采样数据 
                if (sampleBits === 8) {
                    for (var i = 0; i < bytes.length; i++, offset++) {
                        var s = Math.max(-1, Math.min(1, bytes[i]));
                        var val = s < 0 ? s * 0x8000 : s * 0x7FFF;
                        val = parseInt(255 / (65535 / (val + 32768)));
                        data.setInt8(offset, val, true);
                    }
                } else {
                    for (var i = 0; i < bytes.length; i++, offset += 2) {
                        var s = Math.max(-1, Math.min(1, bytes[i]));
                        data.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                    }
                }

 
                return new Blob([data], { type: 'audio/mp3' });
            },
            save: function (clipLabel, blob) { //保存至文件
                var path = createFile();
                clipLabel.textContent = path;
                var curPath = '/sdcard/record/' + path + '.mp3';
                var request = sdcard.addNamed(blob, curPath);

                request.onsuccess = function () {
                    var ret = sdcard.freeSpace();

                    ret.onsuccess = function () {
                        if(blob.size > ret.result)
                            alert("空间不足");
                    };
                    ret.onerror = function () {
                        console.log(ret.error);
                    };
                  };
                  request.onerror = function () {
                    console.log(request.error);
                  };
            },
            cut: function (blob, start, length, callback) {
                var self = this;
                fileToArrayBuffer(blob).then((arrBuffer) => {
                    context.decodeAudioData(arrBuffer, function(audioBuffer) {

                        // 声道数量和采样率
                        var channels = audioBuffer.numberOfChannels;
                        var rate = audioBuffer.sampleRate;
    
                        // 截取
                        var startOffset = start;
                        var endOffset = rate * length;
                        // length秒对应的帧数
                        var frameCount = endOffset - startOffset;
    
                        // 创建同样采用率、同样声道数量，长度是length的空的AudioBuffer
                        var newAudioBuffer = new AudioContext().createBuffer(channels, endOffset - startOffset, rate);
                        // 创建临时的Array存放复制的buffer数据
                        var anotherArray = new Float32Array(frameCount);
                        // 声道的数据的复制和写入
                        var offset = 0;
                        for (var channel = 0; channel < channels; channel++) {
                            audioBuffer.copyFromChannel(anotherArray, channel, startOffset);
                            newAudioBuffer.copyToChannel(anotherArray, channel, offset);
                        }
                        console.log(newAudioBuffer);
    
                        // newAudioBuffer就是全新的复制的length秒长度的AudioBuffer对象

                        //把audioBuffer转为 wav
                        var blob = bufferToWave(newAudioBuffer, newAudioBuffer.length);

                        console.log(blob);

                        callback(blob);
                    });
                });
            }
        };
 
        //开始录音
        this.start = function () {
            audioInput.connect(recorder);
            recorder.connect(context.destination);
        }
 
        //停止
        this.stop = function () {
            recorder.disconnect();
            var blob = this.getBlob();
            this.show(blob);
        }

        //页面显示
        this.show = function (blob) {
            var clipContainer = document.createElement('article');
            var clipLabel = document.createElement('p'); //name框
            var audio = document.createElement('audio'); //audio
            var deleteButton = document.createElement('button'); //删除button
            var clipLabel_start = document.createElement('textarea'); //开始时间框
            var clipLabel_length = document.createElement('textarea'); //时长
            var cutButton = document.createElement('button'); //剪切button
            
            clipContainer.classList.add('clip');
            audio.setAttribute('controls','');
            deleteButton.textContent = 'Delete';
            deleteButton.className = 'delete';
            cutButton.textContent = 'CUT';
            cutButton.className = 'cut';

            audio.controls = true;

            clipContainer.appendChild(audio);
            clipContainer.appendChild(clipLabel);
            clipContainer.appendChild(deleteButton);
            clipContainer.appendChild(clipLabel_start);
            clipContainer.appendChild(clipLabel_length);
            clipContainer.appendChild(cutButton);
            soundClips.appendChild(clipContainer);


            audioData.save(clipLabel, blob); //保存文件,并显示文件名

            var audioURL = window.URL.createObjectURL(blob);
            audio.src = audioURL;
            audio.volume = 1.0;
            audio.load();
            audio.play(); //播放
            console.log("录音录完成");
            console.log("record-hardware==============clipLabel.onclick");

            //删除
            deleteButton.onclick = function(e) {
                evtTgt = e.target;
                evtTgt.parentNode.parentNode.removeChild(evtTgt.parentNode);
                console.log(e);
                console.log(clipLabel.textContent);
                sdcard.delete('/sdcard/record/' + clipLabel.textContent + '.mp3'); //删除sdcard下文件
            }

            //重命名
            clipLabel.onclick = function() {
                var existingName = clipLabel.textContent;
                var oldPath = '/sdcard/record/' + existingName  + '.mp3';
                var newClipName = prompt("给你的录音起个新名字：");
                if (newClipName === null){
                    clipLabel.textContent = existingName;
                } else {
                    clipLabel.textContent = newClipName;
                    sdcard.move(oldPath, '/sdcard/record/', newClipName + '.mp3');
                }
            }
            
            var self = this;
            //剪切
            cutButton.onclick = function() {

                startTime = clipLabel_start.value;
                timeLength = clipLabel_length.value;

                console.log(startTime);
                console.log(timeLength);
                console.log(audioData.time);

                if (startTime + timeLength > audioData.time) {
                    console.log("参数错误");
                    return;
                }

                audioData.cut(blob, startTime, timeLength, function(aBlob) {
                    console.log(aBlob);
                    self.show_1(aBlob);
                });
            }
        }

        //中转显示
        this.show_1 = function (aBlob) {
            this.show(aBlob);
        }
 
        //获取音频文件
        this.getBlob = function () {
            // this.stop();
            return audioData.encodeWAV();
        }
 
        //回放
        this.play = function (audio) {
            var downRec = document.getElementById("play");
            console.log(downRec);
            downRec.href = window.URL.createObjectURL(this.getBlob());
            downRec.download = new Date().toLocaleString()+".mp3";
            audio.src = window.URL.createObjectURL(this.getBlob());
        }
 
        //上传
        this.upload = function (url, callback) {
            var fd = new FormData();
            fd.append("audioData", this.getBlob());
            var xhr = new XMLHttpRequest();
            if (callback) {
                xhr.upload.addEventListener("progress", function (e) {
                    callback('uploading', e);
                }, false);
                xhr.addEventListener("load", function (e) {
                    callback('ok', e);
                }, false);
                xhr.addEventListener("error", function (e) {
                    callback('error', e);
                }, false);
                xhr.addEventListener("abort", function (e) {
                    callback('cancel', e);
                }, false);
            }
            xhr.open("POST", url);
            xhr.send(fd);
        }
 
        //音频采集
        recorder.onaudioprocess = function (e) {
            audioData.input(e.inputBuffer.getChannelData(0));
            // console.log(audioData);
            //record(e.inputBuffer.getChannelData(0));
        }
    };

    //抛出异常
    HZRecorder.throwError = function (message) {
        alert(message);
        throw new function () { this.toString = function () { return message; } }
    }
    //是否支持录音
    HZRecorder.canRecording = (navigator.getUserMedia != null);
    //获取录音机
    HZRecorder.get = function (callback, config) {
        if (callback) {
            if (navigator.mediaDevices.getUserMedia) {
            var onSuccess = function (stream) {
                console.log(stream);
                var rec = new HZRecorder(stream, config);
                callback(rec);
            };
            var onError = function (error) {
                    switch (error.code || error.name) {
                        case 'PERMISSION_DENIED':
                        case 'PermissionDeniedError':
                            HZRecorder.throwError('用户拒绝提供信息。');
                            break;
                        case 'NOT_SUPPORTED_ERROR':
                        case 'NotSupportedError':
                            HZRecorder.throwError('浏览器不支持硬件设备。');
                            break;
                        case 'MANDATORY_UNSATISFIED_ERROR':
                        case 'MandatoryUnsatisfiedError':
                            HZRecorder.throwError('无法发现指定的硬件设备。');
                            break;
                        default:
                            HZRecorder.throwError('无法打开麦克风。异常信息:' + (error.code || error.name));
                            break;
                    }
                };
                navigator.mediaDevices.getUserMedia({ audio: true }).then(onSuccess,onError); //只启用音频
            } else {
                HZRecorder.throwErr('当前浏览器不支持录音功能。'); return;
            }
        }
    }
 
    window.HZRecorder = HZRecorder;
 
})(window);