import modelJsonRaw from '../../models/Ultra-Light-Fast-Generic-Face-Detector-1MB/model.json';
import modelBinPath from '../../models/Ultra-Light-Fast-Generic-Face-Detector-1MB/group1-shard1of1.bin';

const modelJsonPath = modelJsonRaw as unknown as string;

export { modelJsonPath, modelBinPath };
