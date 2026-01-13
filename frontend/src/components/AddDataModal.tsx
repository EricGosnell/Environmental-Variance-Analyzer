import React, { useState } from "react";

type AddDataModalProps = {
  show: boolean;
  onCancel: () => void;
  onUpload?: (payload: { file: File | null; podId: string; podLocation: string; podDataNotes: string }) => void;
};

const AddDataModal: React.FC<AddDataModalProps> = ({ show, onCancel, onUpload }) => {
  const [file, setFile] = useState<File | null>(null);
  const [podId, setPodId] = useState<string>("");
  const [podLocation, setPodLocation] = useState<string>("");
  const [podDataNotes, setPodDataNotes] = useState<string>("");

  if (!show) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files && e.target.files.length > 0 ? e.target.files[0] : null;
    setFile(selected);
  };
  

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpload) {
      onUpload({ file, podId, podLocation, podDataNotes });
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Upload EVA Data">
      <div className="modal">
        <header className="modal-header">
          <h2>Upload EVA Data</h2>
        </header>
        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="form-row">
            <label>
              File
              <input type="file" name="evaFile" accept=".csv,text/csv" onChange={handleFileChange} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Pod ID
              <input
                type="text"
                name="podId"
                value={podId}
                onChange={(e) => setPodId(e.target.value)}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Pod Location
              <input
                type="text"
                name="podLocation"
                value={podLocation}
                onChange={(e) => setPodLocation(e.target.value)}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Notes
              <textarea
                name="podDataNotes"
                value={podDataNotes}
                onChange={(e) => setPodDataNotes(e.target.value)}
                rows={3}
              />
            </label>
          </div>
          <footer className="modal-footer">
            <button type="submit">Upload</button>
            <button type="button" onClick={onCancel}>
              Cancel Upload
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default AddDataModal;


