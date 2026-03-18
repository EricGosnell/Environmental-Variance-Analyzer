import { useEffect, useMemo, useState } from "react";
import { FiSearch, FiX } from "react-icons/fi";

import { addPodOwner, ApiError } from "../utils/api";
import type { PodOwnerCandidate } from "../utils/apiTypes";
import "../styles/SharePodModal.css";

type SharePodModalProps = {
  show: boolean;
  podId: string;
  onClose: () => void;
};

function getCandidateInitial(candidate: PodOwnerCandidate): string {
  const source = candidate.username || candidate.email || "?";
  return source.charAt(0).toUpperCase();
}

export default function SharePodModal({ show, podId, onClose }: SharePodModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PodOwnerCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const trimmedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    if (!show) return;
    setQuery("");
    setResults([]);
    setIsSearching(false);
    setSearchError(null);
    setAddingUserId(null);
    setFeedback(null);
  }, [show, podId]);

  useEffect(() => {
    if (!show) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [show, onClose]);

  useEffect(() => {
    if (!show) return;
    if (!podId || trimmedQuery.length < 2) {
      setResults([]);
      setSearchError(null);
      return;
    }

    let cancelled = false;
    let ac: AbortController | null = null;
    const timeoutId = window.setTimeout(() => {
      ac = new AbortController();
      setIsSearching(true);
      setSearchError(null);

      // TODO:
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      ac?.abort();
    };
  }, [show, podId, trimmedQuery]);

  async function handleAddOwner(candidate: PodOwnerCandidate): Promise<void> {
    setFeedback(null);
    setAddingUserId(candidate.id);
    try {
      await addPodOwner(podId, { userId: candidate.id });
      setResults((prev) => prev.filter((user) => user.id !== candidate.id));
      setFeedback(`Added ${candidate.username} as an owner.`);
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 409) {
        setFeedback(`${candidate.username} is already an owner.`);
      } else {
        const message = e instanceof Error ? e.message : "Failed to add owner.";
        setFeedback(message);
      }
    } finally {
      setAddingUserId(null);
    }
  }

  if (!show) return null;

  return (
    <div className="share-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="share-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add collaborators"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="share-modal-header">
          <div>
            <h2 className="share-modal-title">Add collaborators</h2>
            <p className="share-modal-subtitle">Search by username or email</p>
          </div>
          <button type="button" className="share-modal-close" aria-label="Close" onClick={onClose}>
            <FiX size={18} />
          </button>
        </header>

        <div className="share-modal-search-wrap">
          <FiSearch size={16} className="share-modal-search-icon" aria-hidden="true" />
          <input
            type="text"
            className="share-modal-search-input"
            placeholder="Search people..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
        </div>

        {feedback ? <div className="share-modal-feedback">{feedback}</div> : null}
        {searchError ? <div className="share-modal-error">{searchError}</div> : null}

        <div className="share-modal-results">
          {trimmedQuery.length < 2 ? (
            <div className="share-modal-empty">Type at least 2 characters to search.</div>
          ) : isSearching ? (
            <div className="share-modal-empty">Searching...</div>
          ) : results.length === 0 ? (
            <div className="share-modal-empty">No matching users found.</div>
          ) : (
            <ul className="share-modal-list">
              {results.map((candidate) => (
                <li key={candidate.id} className="share-modal-item">
                  <div className="share-modal-user">
                    <span className="share-modal-avatar" aria-hidden="true">
                      {getCandidateInitial(candidate)}
                    </span>
                    <div className="share-modal-user-text">
                      <span className="share-modal-username">{candidate.username}</span>
                      <span className="share-modal-email">{candidate.email ?? "No email available"}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="share-modal-add-btn"
                    onClick={() => handleAddOwner(candidate)}
                    disabled={addingUserId === candidate.id}
                  >
                    {addingUserId === candidate.id ? "Adding..." : "Add"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="share-modal-footer">
          <button type="button" className="share-modal-done-btn" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
