"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RWLock = void 0;
const fs_1 = require("fs");
const path = require("path");
/**
 * A single-writer/multi-reader lock on a directory
 *
 * It uses marker files with PIDs in them as a locking marker; the PIDs will be
 * checked for liveness, so that if the process exits without cleaning up the
 * files the lock is implicitly released.
 *
 * This class is not 100% race safe, but in practice it should be a lot
 * better than the 0 protection we have today.
 */
/* istanbul ignore next: code paths are unpredictable */
class RWLock {
    constructor(directory) {
        this.directory = directory;
        this.readCounter = 0;
        this.pidString = `${process.pid}`;
        this.writerFile = path.join(this.directory, 'synth.lock');
    }
    /**
     * Acquire a writer lock.
     *
     * No other readers or writers must exist for the given directory.
     */
    async acquireWrite() {
        await this.assertNoOtherWriters();
        const readers = await this.currentReaders();
        if (readers.length > 0) {
            throw new Error(`Other CLIs (PID=${readers}) are currently reading from ${this.directory}. Invoke the CLI in sequence, or use '--output' to synth into different directories.`);
        }
        await writeFileAtomic(this.writerFile, this.pidString);
        return {
            release: async () => {
                await deleteFile(this.writerFile);
            },
            convertToReaderLock: async () => {
                // Acquire the read lock before releasing the write lock. Slightly less
                // chance of racing!
                const ret = await this.doAcquireRead();
                await deleteFile(this.writerFile);
                return ret;
            },
        };
    }
    /**
     * Acquire a read lock
     *
     * Will fail if there are any writers.
     */
    async acquireRead() {
        await this.assertNoOtherWriters();
        return this.doAcquireRead();
    }
    /**
     * Obtains the name fo a (new) `readerFile` to use. This includes a counter so
     * that if multiple threads of the same PID attempt to concurrently acquire
     * the same lock, they're guaranteed to use a different reader file name (only
     * one thread will ever execute JS code at once, guaranteeing the readCounter
     * is incremented "atomically" from the point of view of this PID.).
     */
    readerFile() {
        return path.join(this.directory, `read.${this.pidString}.${++this.readCounter}.lock`);
    }
    /**
     * Do the actual acquiring of a read lock.
     */
    async doAcquireRead() {
        const readerFile = this.readerFile();
        await writeFileAtomic(readerFile, this.pidString);
        return {
            release: async () => {
                await deleteFile(readerFile);
            },
        };
    }
    async assertNoOtherWriters() {
        const writer = await this.currentWriter();
        if (writer) {
            throw new Error(`Another CLI (PID=${writer}) is currently synthing to ${this.directory}. Invoke the CLI in sequence, or use '--output' to synth into different directories.`);
        }
    }
    /**
     * Check the current writer (if any)
     */
    async currentWriter() {
        const contents = await readFileIfExists(this.writerFile);
        if (!contents) {
            return undefined;
        }
        const pid = parseInt(contents, 10);
        if (!processExists(pid)) {
            // Do cleanup of a stray file now
            await deleteFile(this.writerFile);
            return undefined;
        }
        return pid;
    }
    /**
     * Check the current readers (if any)
     */
    async currentReaders() {
        const re = /^read\.([^.]+)\.[^.]+\.lock$/;
        const ret = new Array();
        let children;
        try {
            children = await fs_1.promises.readdir(this.directory, { encoding: 'utf-8' });
        }
        catch (e) {
            // Can't be locked if the directory doesn't exist
            if (e.code === 'ENOENT') {
                return [];
            }
            throw e;
        }
        for (const fname of children) {
            const m = fname.match(re);
            if (m) {
                const pid = parseInt(m[1], 10);
                if (processExists(pid)) {
                    ret.push(pid);
                }
                else {
                    // Do cleanup of a stray file now
                    await deleteFile(path.join(this.directory, fname));
                }
            }
        }
        return ret;
    }
}
exports.RWLock = RWLock;
/* istanbul ignore next: code paths are unpredictable */
async function readFileIfExists(filename) {
    try {
        return await fs_1.promises.readFile(filename, { encoding: 'utf-8' });
    }
    catch (e) {
        if (e.code === 'ENOENT') {
            return undefined;
        }
        throw e;
    }
}
let tmpCounter = 0;
/* istanbul ignore next: code paths are unpredictable */
async function writeFileAtomic(filename, contents) {
    await fs_1.promises.mkdir(path.dirname(filename), { recursive: true });
    const tmpFile = `${filename}.${process.pid}_${++tmpCounter}`;
    await fs_1.promises.writeFile(tmpFile, contents, { encoding: 'utf-8' });
    await fs_1.promises.rename(tmpFile, filename);
}
/* istanbul ignore next: code paths are unpredictable */
async function deleteFile(filename) {
    try {
        await fs_1.promises.unlink(filename);
    }
    catch (e) {
        if (e.code === 'ENOENT') {
            return;
        }
        throw e;
    }
}
/* istanbul ignore next: code paths are unpredictable */
function processExists(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (e) {
        return false;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicndsb2NrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicndsb2NrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDJCQUFvQztBQUNwQyw2QkFBNkI7QUFFN0I7Ozs7Ozs7OztHQVNHO0FBQ0gsd0RBQXdEO0FBQ3hELE1BQWEsTUFBTTtJQUtqQixZQUE0QixTQUFpQjtRQUFqQixjQUFTLEdBQVQsU0FBUyxDQUFRO1FBRnJDLGdCQUFXLEdBQUcsQ0FBQyxDQUFDO1FBR3RCLElBQUksQ0FBQyxTQUFTLEdBQUcsR0FBRyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUM7UUFFbEMsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsWUFBWSxDQUFDLENBQUM7SUFDNUQsQ0FBQztJQUVEOzs7O09BSUc7SUFDSSxLQUFLLENBQUMsWUFBWTtRQUN2QixNQUFNLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO1FBRWxDLE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQzVDLElBQUksT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUN2QixNQUFNLElBQUksS0FBSyxDQUFDLG1CQUFtQixPQUFPLGdDQUFnQyxJQUFJLENBQUMsU0FBUyxzRkFBc0YsQ0FBQyxDQUFDO1FBQ2xMLENBQUM7UUFFRCxNQUFNLGVBQWUsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUV2RCxPQUFPO1lBQ0wsT0FBTyxFQUFFLEtBQUssSUFBSSxFQUFFO2dCQUNsQixNQUFNLFVBQVUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDcEMsQ0FBQztZQUNELG1CQUFtQixFQUFFLEtBQUssSUFBSSxFQUFFO2dCQUM5Qix1RUFBdUU7Z0JBQ3ZFLG9CQUFvQjtnQkFDcEIsTUFBTSxHQUFHLEdBQUcsTUFBTSxJQUFJ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QUFFLENBQUMsQ0FBQztJQUM3RCxNQUFNLGFBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQ3JDLENBQUM7QUFFRCx3REFBd0Q7QUFDeEQsS0FBSyxVQUFVLFVBQVUsQ0FBQyxRQUFnQjtJQUN4QyxJQUFJLENBQUM7UUFDSCxNQUFNLGFBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDNUIsQ0FBQztJQUFDLE9BQU8sQ0FBTSxFQUFFLENBQUM7UUFDaEIsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQ3hCLE9BQU87UUFDVCxDQUFDO1FBQ0QsTUFBTSxDQUFDLENBQUM7SUFDVixDQUFDO0FBQ0gsQ0FBQztBQUVELHdEQUF3RDtBQUN4RCxTQUFTLGFBQWEsQ0FBQyxHQUFXO0lBQ2hDLElBQUksQ0FBQztRQUNILE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3JCLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7UUFDWCxPQUFPLEtBQUssQ0FBQztJQUNmLENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcHJvbWlzZXMgYXMgZnMgfSBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuXG4vKipcbiAqIEEgc2luZ2xlLXdyaXRlci9tdWx0aS1yZWFkZXIgbG9jayBvbiBhIGRpcmVjdG9yeVxuICpcbiAqIEl0IHVzZXMgbWFya2VyIGZpbGVzIHdpdGggUElEcyBpbiB0aGVtIGFzIGEgbG9ja2luZyBtYXJrZXI7IHRoZSBQSURzIHdpbGwgYmVcbiAqIGNoZWNrZWQgZm9yIGxpdmVuZXNzLCBzbyB0aGF0IGlmIHRoZSBwcm9jZXNzIGV4aXRzIHdpdGhvdXQgY2xlYW5pbmcgdXAgdGhlXG4gKiBmaWxlcyB0aGUgbG9jayBpcyBpbXBsaWNpdGx5IHJlbGVhc2VkLlxuICpcbiAqIFRoaXMgY2xhc3MgaXMgbm90IDEwMCUgcmFjZSBzYWZlLCBidXQgaW4gcHJhY3RpY2UgaXQgc2hvdWxkIGJlIGEgbG90XG4gKiBiZXR0ZXIgdGhhbiB0aGUgMCBwcm90ZWN0aW9uIHdlIGhhdmUgdG9kYXkuXG4gKi9cbi8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0OiBjb2RlIHBhdGhzIGFyZSB1bnByZWRpY3RhYmxlICovXG5leHBvcnQgY2xhc3MgUldMb2NrIHtcbiAgcHJpdmF0ZSByZWFkb25seSBwaWRTdHJpbmc6IHN0cmluZztcbiAgcHJpdmF0ZSByZWFkb25seSB3cml0ZXJGaWxlOiBzdHJpbmc7XG4gIHByaXZhdGUgcmVhZENvdW50ZXIgPSAwO1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyByZWFkb25seSBkaXJlY3Rvcnk6IHN0cmluZykge1xuICAgIHRoaXMucGlkU3RyaW5nID0gYCR7cHJvY2Vzcy5waWR9YDtcblxuICAgIHRoaXMud3JpdGVyRmlsZSA9IHBhdGguam9pbih0aGlzLmRpcmVjdG9yeSwgJ3N5bnRoLmxvY2snKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBY3F1aXJlIGEgd3JpdGVyIGxvY2suXG4gICAqXG4gICAqIE5vIG90aGVyIHJlYWRlcnMgb3Igd3JpdGVycyBtdXN0IGV4aXN0IGZvciB0aGUgZ2l2ZW4gZGlyZWN0b3J5LlxuICAgKi9cbiAgcHVibGljIGFzeW5jIGFjcXVpcmVXcml0ZSgpOiBQcm9taXNlPElXcml0ZXJMb2NrPiB7XG4gICAgYXdhaXQgdGhpcy5hc3NlcnROb090aGVyV3JpdGVycygpO1xuXG4gICAgY29uc3QgcmVhZGVycyA9IGF3YWl0IHRoaXMuY3VycmVudFJlYWRlcnMoKTtcbiAgICBpZiAocmVhZGVycy5sZW5ndGggPiAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYE90aGVyIENMSXMgKFBJRD0ke3JlYWRlcnN9KSBhcmUgY3VycmVudGx5IHJlYWRpbmcgZnJvbSAke3RoaXMuZGlyZWN0b3J5fS4gSW52b2tlIHRoZSBDTEkgaW4gc2VxdWVuY2UsIG9yIHVzZSAnLS1vdXRwdXQnIHRvIHN5bnRoIGludG8gZGlmZmVyZW50IGRpcmVjdG9yaWVzLmApO1xuICAgIH1cblxuICAgIGF3YWl0IHdyaXRlRmlsZUF0b21pYyh0aGlzLndyaXRlckZpbGUsIHRoaXMucGlkU3RyaW5nKTtcblxuICAgIHJldHVybiB7XG4gICAgICByZWxlYXNlOiBhc3luYyAoKSA9PiB7XG4gICAgICAgIGF3YWl0IGRlbGV0ZUZpbGUodGhpcy53cml0ZXJGaWxlKTtcbiAgICAgIH0sXG4gICAgICBjb252ZXJ0VG9SZWFkZXJMb2NrOiBhc3luYyAoKSA9PiB7XG4gICAgICAgIC8vIEFjcXVpcmUgdGhlIHJlYWQgbG9jayBiZWZvcmUgcmVsZWFzaW5nIHRoZSB3cml0ZSBsb2NrLiBTbGlnaHRseSBsZXNzXG4gICAgICAgIC8vIGNoYW5jZSBvZiByYWNpbmchXG4gICAgICAgIGNvbnN0IHJldCA9IGF3YWl0IHRoaXMuZG9BY3F1aXJlUmVhZCgpO1xuICAgICAgICBhd2FpdCBkZWxldGVGaWxlKHRoaXMud3JpdGVyRmlsZSk7XG4gICAgICAgIHJldHVybiByZXQ7XG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQWNxdWlyZSBhIHJlYWQgbG9ja1xuICAgKlxuICAgKiBXaWxsIGZhaWwgaWYgdGhlcmUgYXJlIGFueSB3cml0ZXJzLlxuICAgKi9cbiAgcHVibGljIGFzeW5jIGFjcXVpcmVSZWFkKCk6IFByb21pc2U8SUxvY2s+IHtcbiAgICBhd2FpdCB0aGlzLmFzc2VydE5vT3RoZXJXcml0ZXJzKCk7XG4gICAgcmV0dXJuIHRoaXMuZG9BY3F1aXJlUmVhZCgpO1xuICB9XG5cbiAgLyoqXG4gICAqIE9idGFpbnMgdGhlIG5hbWUgZm8gYSAobmV3KSBgcmVhZGVyRmlsZWAgdG8gdXNlLiBUaGlzIGluY2x1ZGVzIGEgY291bnRlciBzb1xuICAgKiB0aGF0IGlmIG11bHRpcGxlIHRocmVhZHMgb2YgdGhlIHNhbWUgUElEIGF0dGVtcHQgdG8gY29uY3VycmVudGx5IGFjcXVpcmVcbiAgICogdGhlIHNhbWUgbG9jaywgdGhleSdyZSBndWFyYW50ZWVkIHRvIHVzZSBhIGRpZmZlcmVudCByZWFkZXIgZmlsZSBuYW1lIChvbmx5XG4gICAqIG9uZSB0aHJlYWQgd2lsbCBldmVyIGV4ZWN1dGUgSlMgY29kZSBhdCBvbmNlLCBndWFyYW50ZWVpbmcgdGhlIHJlYWRDb3VudGVyXG4gICAqIGlzIGluY3JlbWVudGVkIFwiYXRvbWljYWxseVwiIGZyb20gdGhlIHBvaW50IG9mIHZpZXcgb2YgdGhpcyBQSUQuKS5cbiAgICovXG4gIHByaXZhdGUgcmVhZGVyRmlsZSgpOiBzdHJpbmcge1xuICAgIHJldHVybiBwYXRoLmpvaW4odGhpcy5kaXJlY3RvcnksIGByZWFkLiR7dGhpcy5waWRTdHJpbmd9LiR7Kyt0aGlzLnJlYWRDb3VudGVyfS5sb2NrYCk7XG4gIH1cblxuICAvKipcbiAgICogRG8gdGhlIGFjdHVhbCBhY3F1aXJpbmcgb2YgYSByZWFkIGxvY2suXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGRvQWNxdWlyZVJlYWQoKTogUHJvbWlzZTxJTG9jaz4ge1xuICAgIGNvbnN0IHJlYWRlckZpbGUgPSB0aGlzLnJlYWRlckZpbGUoKTtcbiAgICBhd2FpdCB3cml0ZUZpbGVBdG9taWMocmVhZGVyRmlsZSwgdGhpcy5waWRTdHJpbmcpO1xuICAgIHJldHVybiB7XG4gICAgICByZWxlYXNlOiBhc3luYyAoKSA9PiB7XG4gICAgICAgIGF3YWl0IGRlbGV0ZUZpbGUocmVhZGVyRmlsZSk7XG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGFzc2VydE5vT3RoZXJXcml0ZXJzKCkge1xuICAgIGNvbnN0IHdyaXRlciA9IGF3YWl0IHRoaXMuY3VycmVudFdyaXRlcigpO1xuICAgIGlmICh3cml0ZXIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQW5vdGhlciBDTEkgKFBJRD0ke3dyaXRlcn0pIGlzIGN1cnJlbnRseSBzeW50aGluZyB0byAke3RoaXMuZGlyZWN0b3J5fS4gSW52b2tlIHRoZSBDTEkgaW4gc2VxdWVuY2UsIG9yIHVzZSAnLS1vdXRwdXQnIHRvIHN5bnRoIGludG8gZGlmZmVyZW50IGRpcmVjdG9yaWVzLmApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayB0aGUgY3VycmVudCB3cml0ZXIgKGlmIGFueSlcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgY3VycmVudFdyaXRlcigpOiBQcm9taXNlPG51bWJlciB8IHVuZGVmaW5lZD4ge1xuICAgIGNvbnN0IGNvbnRlbnRzID0gYXdhaXQgcmVhZEZpbGVJZkV4aXN0cyh0aGlzLndyaXRlckZpbGUpO1xuICAgIGlmICghY29udGVudHMpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXG4gICAgY29uc3QgcGlkID0gcGFyc2VJbnQoY29udGVudHMsIDEwKTtcbiAgICBpZiAoIXByb2Nlc3NFeGlzdHMocGlkKSkge1xuICAgICAgLy8gRG8gY2xlYW51cCBvZiBhIHN0cmF5IGZpbGUgbm93XG4gICAgICBhd2FpdCBkZWxldGVGaWxlKHRoaXMud3JpdGVyRmlsZSk7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHJldHVybiBwaWQ7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgdGhlIGN1cnJlbnQgcmVhZGVycyAoaWYgYW55KVxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBjdXJyZW50UmVhZGVycygpOiBQcm9taXNlPG51bWJlcltdPiB7XG4gICAgY29uc3QgcmUgPSAvXnJlYWRcXC4oW14uXSspXFwuW14uXStcXC5sb2NrJC87XG4gICAgY29uc3QgcmV0ID0gbmV3IEFycmF5PG51bWJlcj4oKTtcblxuICAgIGxldCBjaGlsZHJlbjtcbiAgICB0cnkge1xuICAgICAgY2hpbGRyZW4gPSBhd2FpdCBmcy5yZWFkZGlyKHRoaXMuZGlyZWN0b3J5LCB7IGVuY29kaW5nOiAndXRmLTgnIH0pO1xuICAgIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgICAgLy8gQ2FuJ3QgYmUgbG9ja2VkIGlmIHRoZSBkaXJlY3RvcnkgZG9lc24ndCBleGlzdFxuICAgICAgaWYgKGUuY29kZSA9PT0gJ0VOT0VOVCcpIHsgcmV0dXJuIFtdOyB9XG4gICAgICB0aHJvdyBlO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgZm5hbWUgb2YgY2hpbGRyZW4pIHtcbiAgICAgIGNvbnN0IG0gPSBmbmFtZS5tYXRjaChyZSk7XG4gICAgICBpZiAobSkge1xuICAgICAgICBjb25zdCBwaWQgPSBwYXJzZUludChtWzFdLCAxMCk7XG4gICAgICAgIGlmIChwcm9jZXNzRXhpc3RzKHBpZCkpIHtcbiAgICAgICAgICByZXQucHVzaChwaWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIERvIGNsZWFudXAgb2YgYSBzdHJheSBmaWxlIG5vd1xuICAgICAgICAgIGF3YWl0IGRlbGV0ZUZpbGUocGF0aC5qb2luKHRoaXMuZGlyZWN0b3J5LCBmbmFtZSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXQ7XG4gIH1cbn1cblxuLyoqXG4gKiBBbiBhY3F1aXJlZCBsb2NrXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSUxvY2sge1xuICByZWxlYXNlKCk6IFByb21pc2U8dm9pZD47XG59XG5cbi8qKlxuICogQW4gYWNxdWlyZWQgd3JpdGVyIGxvY2tcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJV3JpdGVyTG9jayBleHRlbmRzIElMb2NrIHtcbiAgLyoqXG4gICAqIENvbnZlcnQgdGhlIHdyaXRlciBsb2NrIHRvIGEgcmVhZGVyIGxvY2tcbiAgICovXG4gIGNvbnZlcnRUb1JlYWRlckxvY2soKTogUHJvbWlzZTxJTG9jaz47XG59XG5cbi8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0OiBjb2RlIHBhdGhzIGFyZSB1bnByZWRpY3RhYmxlICovXG5hc3luYyBmdW5jdGlvbiByZWFkRmlsZUlmRXhpc3RzKGZpbGVuYW1lOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuICB0cnkge1xuICAgIHJldHVybiBhd2FpdCBmcy5yZWFkRmlsZShmaWxlbmFtZSwgeyBlbmNvZGluZzogJ3V0Zi04JyB9KTtcbiAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgaWYgKGUuY29kZSA9PT0gJ0VOT0VOVCcpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuICAgIHRocm93IGU7XG4gIH1cbn1cblxubGV0IHRtcENvdW50ZXIgPSAwO1xuLyogaXN0YW5idWwgaWdub3JlIG5leHQ6IGNvZGUgcGF0aHMgYXJlIHVucHJlZGljdGFibGUgKi9cbmFzeW5jIGZ1bmN0aW9uIHdyaXRlRmlsZUF0b21pYyhmaWxlbmFtZTogc3RyaW5nLCBjb250ZW50czogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIGF3YWl0IGZzLm1rZGlyKHBhdGguZGlybmFtZShmaWxlbmFtZSksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICBjb25zdCB0bXBGaWxlID0gYCR7ZmlsZW5hbWV9LiR7cHJvY2Vzcy5waWR9XyR7Kyt0bXBDb3VudGVyfWA7XG4gIGF3YWl0IGZzLndyaXRlRmlsZSh0bXBGaWxlLCBjb250ZW50cywgeyBlbmNvZGluZzogJ3V0Zi04JyB9KTtcbiAgYXdhaXQgZnMucmVuYW1lKHRtcEZpbGUsIGZpbGVuYW1lKTtcbn1cblxuLyogaXN0YW5idWwgaWdub3JlIG5leHQ6IGNvZGUgcGF0aHMgYXJlIHVucHJlZGljdGFibGUgKi9cbmFzeW5jIGZ1bmN0aW9uIGRlbGV0ZUZpbGUoZmlsZW5hbWU6IHN0cmluZykge1xuICB0cnkge1xuICAgIGF3YWl0IGZzLnVubGluayhmaWxlbmFtZSk7XG4gIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgIGlmIChlLmNvZGUgPT09ICdFTk9FTlQnKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRocm93IGU7XG4gIH1cbn1cblxuLyogaXN0YW5idWwgaWdub3JlIG5leHQ6IGNvZGUgcGF0aHMgYXJlIHVucHJlZGljdGFibGUgKi9cbmZ1bmN0aW9uIHByb2Nlc3NFeGlzdHMocGlkOiBudW1iZXIpIHtcbiAgdHJ5IHtcbiAgICBwcm9jZXNzLmtpbGwocGlkLCAwKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuIl19