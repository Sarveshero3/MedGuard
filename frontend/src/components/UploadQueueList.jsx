export function UploadQueueList({
  uploadedFiles,
  setUploadedFiles,
  activeFileId,
  setActiveFileId,
  handleUploadAll,
  handleRemoveFromQueue,
  triggerFileSelect,
  isCollapsed,
  setIsCollapsed
}) {
  if (isCollapsed) {
    return (
      <div className="lg:col-span-1 space-y-4 border-r border-slate-100 pr-0 lg:pr-2 text-center flex flex-col items-center">
        {/* Toggle Expand Button */}
        <button
          onClick={() => setIsCollapsed(false)}
          title="Expand Upload Queue"
          className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors border border-slate-200"
        >
          <span className="material-symbols-outlined text-sm font-bold">chevron_right</span>
        </button>

        <div className="w-full border-t border-slate-100 my-2"></div>

        {/* Mini Add Button */}
        <button
          onClick={triggerFileSelect}
          title="Add Files"
          className="w-8 h-8 rounded-lg bg-slate-150 hover:bg-slate-200 text-slate-750 flex items-center justify-center cursor-pointer transition-colors"
        >
          <span className="material-symbols-outlined text-sm">add</span>
        </button>

        {/* Mini Extract All */}
        <button
          onClick={handleUploadAll}
          disabled={uploadedFiles.every(f => f.status !== 'idle')}
          title="Extract All Idle Files"
          className="w-8 h-8 rounded-lg bg-[#0f766e] hover:bg-[#0d645c] disabled:opacity-50 text-white flex items-center justify-center cursor-pointer transition-colors"
        >
          <span className="material-symbols-outlined text-sm">rocket_launch</span>
        </button>

        <div className="w-full border-t border-slate-100 my-2"></div>

        {/* Compact List */}
        <div className="space-y-3 w-full flex flex-col items-center overflow-y-auto max-h-[600px]">
          {uploadedFiles.map((item) => {
            const isActive = activeFileId === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setActiveFileId(item.id)}
                title={`${item.name} (${item.progressMessage})`}
                className={`w-10 h-10 rounded-lg border transition-all cursor-pointer flex items-center justify-center relative group overflow-hidden ${
                  isActive 
                    ? 'border-[#0f766e] bg-teal-50/20 shadow-sm ring-1 ring-[#0f766e]' 
                    : 'bg-white border-slate-200 hover:border-slate-350'
                }`}
              >
                {/* Compact Indicator */}
                {item.saved ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white absolute top-0.5 right-0.5 z-10"></span>
                ) : item.status === 'completed' ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500 border border-white absolute top-0.5 right-0.5 z-10"></span>
                ) : item.status === 'failed' ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 border border-white absolute top-0.5 right-0.5 z-10"></span>
                ) : item.status === 'processing' || item.status === 'uploading' ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500 border border-white absolute top-0.5 right-0.5 z-10 animate-ping"></span>
                ) : null}

                {/* Mini preview */}
                {item.isPdf ? (
                  <span className="material-symbols-outlined text-rose-600 text-lg">picture_as_pdf</span>
                ) : item.preview ? (
                  <img src={item.preview} className="w-full h-full object-cover" alt="Preview" />
                ) : (
                  <span className="material-symbols-outlined text-slate-400 text-lg">image</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Expanded View (Original Layout but shifted to lg:col-span-3)
  return (
    <div className="lg:col-span-3 space-y-4 border-r border-slate-100 pr-0 lg:pr-4 text-left">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCollapsed(true)}
            title="Collapse Queue"
            className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors border border-slate-200"
          >
            <span className="material-symbols-outlined text-xs font-bold">chevron_left</span>
          </button>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Queue ({uploadedFiles.length})</h3>
        </div>
        
        <div className="flex gap-1.5">
          <button
            onClick={() => {
              setUploadedFiles([]);
              setActiveFileId(null);
              sessionStorage.removeItem('medguard_upload_queue');
              sessionStorage.removeItem('medguard_active_file_id');
            }}
            title="Clear All"
            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg cursor-pointer border border-rose-200 flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-xs">delete_sweep</span>
          </button>
          <button
            onClick={triggerFileSelect}
            title="Add File"
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-xs">add</span>
          </button>
          <button
            onClick={handleUploadAll}
            disabled={uploadedFiles.every(f => f.status !== 'idle')}
            title="Extract All"
            className="p-1.5 bg-[#0f766e] hover:bg-[#0d645c] disabled:opacity-50 text-white rounded-lg cursor-pointer flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-xs">rocket_launch</span>
          </button>
        </div>
      </div>
      
      <div className="space-y-3 overflow-y-auto max-h-[600px] pr-2">
        {uploadedFiles.map((item) => {
          const isActive = activeFileId === item.id;
          return (
            <div
              key={item.id}
              onClick={() => setActiveFileId(item.id)}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 relative group ${
                isActive 
                  ? 'bg-teal-50/20 border-[#0f766e] shadow-sm' 
                  : 'bg-white border-slate-200 hover:border-slate-350'
              }`}
            >
              {/* File Thumbnail or PDF icon */}
              <div className="w-10 h-10 rounded bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                {item.isPdf ? (
                  <span className="material-symbols-outlined text-rose-600 text-xl">picture_as_pdf</span>
                ) : item.preview ? (
                  <img src={item.preview} className="w-full h-full object-cover" alt="Preview" />
                ) : (
                  <span className="material-symbols-outlined text-slate-450 text-xl">image</span>
                )}
              </div>

              {/* File Description */}
              <div className="flex-grow min-w-0">
                <h4 className="text-[11px] font-bold text-slate-800 truncate mb-0.5" title={item.name}>
                  {item.name}
                </h4>
                <div className="flex items-center gap-1">
                  <span className="text-[8px] bg-slate-100 text-slate-650 font-bold px-1 rounded uppercase">
                    {item.docType === 'prescription' ? 'Rx' : 'Lab'}
                  </span>
                  <span className={`text-[9px] font-semibold ${
                    item.status === 'completed' ? 'text-emerald-700' :
                    item.status === 'failed' ? 'text-red-650' :
                    item.status === 'processing' ? 'text-sky-650 animate-pulse' :
                    item.status === 'uploading' ? 'text-blue-650' : 'text-slate-400'
                  }`}>
                    {item.progressMessage}
                  </span>
                </div>
              </div>

              {/* Checkmark or Delete */}
              {item.saved ? (
                <span className="material-symbols-outlined text-emerald-600 text-base absolute top-1.5 right-1.5">check_circle</span>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFromQueue(item.id);
                  }}
                  className="absolute top-1.5 right-1.5 text-slate-300 hover:text-red-650 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
