.info-box {
  border: 1px solid #e2e8f0;
  margin-bottom: 1rem;
  transition: all 0.3s ease;
}

.info-box:hover {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.message.achievement {
  background-color: #fef3c7;
  border-color: #fcd34d;
  color: #92400e;
}

/* Optional: Add animation for achievement unlock */
@keyframes achievementUnlock {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.message.achievement {
  animation: achievementUnlock 0.5s ease-in-out;
}
